import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NovaPosDbService } from '../../offline/novapos-db.service';
import {
  CashOpening,
  CompletedOrder,
  DeliveryDriver,
  FloorTable,
  OrderChannel,
  PaymentMethod,
  PosLine,
  Product,
  QueueEntry,
  SyncEventEnvelope,
} from '../models/app.models';
import { SessionService } from './session.service';

function dayKeyFor(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Injectable({ providedIn: 'root' })
export class PosService {
  private readonly db = inject(NovaPosDbService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  readonly cart = signal<PosLine[]>([]);
  readonly paymentMethod = signal<'CASH' | 'CARD'>('CASH');
  readonly lastOrder = signal<CompletedOrder | null>(null);
  readonly editingPreparedOrderId = signal<string | null>(null);
  readonly channel = signal<OrderChannel>('SUR_PLACE');
  readonly selectedTableNumber = signal<string>('');
  readonly selectedLivreurId = signal<string>('');
  readonly customerPhone = signal<string>('');
  readonly deliveryAddress = signal<string>('');

  readonly subtotal = computed(() =>
    this.cart().reduce((sum, line) => sum + line.total, 0),
  );

  setChannel(channel: OrderChannel): void {
    this.channel.set(channel);
    if (channel !== 'SUR_PLACE') this.selectedTableNumber.set('');
    if (channel !== 'LIVRAISON') {
      this.selectedLivreurId.set('');
      this.customerPhone.set('');
      this.deliveryAddress.set('');
    }
  }

  resetContext(): void {
    this.channel.set('SUR_PLACE');
    this.selectedTableNumber.set('');
    this.selectedLivreurId.set('');
    this.customerPhone.set('');
    this.deliveryAddress.set('');
    this.editingPreparedOrderId.set(null);
  }

  addProduct(product: Product): void {
    const current = [...this.cart()];
    const existing = current.find((line) => line.productId === product.id);

    if (existing) {
      existing.quantity += 1;
      existing.total = existing.quantity * existing.unitPrice;
    } else {
      current.push({
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        quantity: 1,
        total: product.price,
      });
    }

    this.cart.set(current);
  }

  removeProduct(productId: string): void {
    const next = this.cart()
      .map((line) =>
        line.productId === productId
          ? { ...line, quantity: line.quantity - 1, total: (line.quantity - 1) * line.unitPrice }
          : line,
      )
      .filter((line) => line.quantity > 0);

    this.cart.set(next);
  }

  clearCart(): void {
    this.cart.set([]);
    this.resetContext();
  }

  async listFloorTables(): Promise<FloorTable[]> {
    return (await this.db.floorTables.toArray()).sort((a, b) => {
      const zone = (a.zone || '').localeCompare(b.zone || '');
      if (zone !== 0) return zone;
      return Number(a.number || 0) - Number(b.number || 0);
    });
  }

  async saveFloorTable(table: FloorTable): Promise<FloorTable> {
    await this.db.floorTables.put(table);
    return table;
  }

  async deleteFloorTable(id: string): Promise<void> {
    await this.db.floorTables.delete(id);
  }

  async listDeliveryDrivers(): Promise<DeliveryDriver[]> {
    return (await this.db.deliveryDrivers.toArray()).sort((a, b) =>
      Number(a.number || 0) - Number(b.number || 0),
    );
  }

  async saveDeliveryDriver(driver: DeliveryDriver): Promise<DeliveryDriver> {
    await this.db.deliveryDrivers.put(driver);
    return driver;
  }

  async deleteDeliveryDriver(id: string): Promise<void> {
    await this.db.deliveryDrivers.delete(id);
  }

  private cashOpeningIdFor(branchId: string, dayKey: string): string {
    return `${branchId}-${dayKey}`;
  }

  async getTodayCashOpening(branchId?: string): Promise<CashOpening | null> {
    const effectiveBranchId = branchId ?? this.session.branch()?.branchId;
    if (!effectiveBranchId) return null;
    const dayKey = dayKeyFor(new Date());
    const id = this.cashOpeningIdFor(effectiveBranchId, dayKey);
    const found = await this.db.cashOpenings.get(id);
    return found ?? null;
  }

  async setTodayCashOpening(
    amount: number,
    currency: string,
    note?: string,
    operatorName?: string,
    branchId?: string,
  ): Promise<CashOpening> {
    const effectiveBranchId = branchId ?? this.session.branch()?.branchId;
    if (!effectiveBranchId) {
      throw new Error('Aucune session active.');
    }
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('Le montant du fond de caisse est invalide.');
    }
    const dayKey = dayKeyFor(new Date());
    const now = new Date().toISOString();
    const id = this.cashOpeningIdFor(effectiveBranchId, dayKey);
    const existing = await this.db.cashOpenings.get(id);
    const record: CashOpening = existing
      ? { ...existing, amount, currency, note: note ?? existing.note, operatorName: operatorName ?? existing.operatorName, lastUpdatedAt: now }
      : {
          id,
          branchId: effectiveBranchId,
          dayKey,
          amount,
          currency,
          note,
          operatorName,
          setAt: now,
          lastUpdatedAt: now,
        };
    await this.db.cashOpenings.put(record);
    return record;
  }

  async prepareOrder(): Promise<CompletedOrder | null> {
    const branch = this.session.branch();
    const user = this.session.user();

    if (!branch || !user || this.cart().length === 0) {
      return null;
    }

    const now = new Date().toISOString();
    const total = this.subtotal();
    const editingOrderId = this.editingPreparedOrderId();

    if (editingOrderId) {
      const existingOrder = await this.db.completedOrders.get(editingOrderId);
      const normalized = existingOrder ? this.normalizeOrder(existingOrder) : null;

      if (!normalized || normalized.status !== 'PREPARED') {
        this.editingPreparedOrderId.set(null);
        return this.prepareOrder();
      }

      const updatedOrder: CompletedOrder = {
        ...normalized,
        total,
        lineCount: this.cart().length,
        lines: this.cart().map((line) => ({ ...line })),
        lastUpdatedAt: now,
        version: normalized.version + 1,
        channel: this.channel(),
        tableNumber: this.channel() === 'SUR_PLACE' ? this.selectedTableNumber() || undefined : undefined,
        livreurId: this.channel() === 'LIVRAISON' ? this.selectedLivreurId() || undefined : undefined,
        deliveryAddress: this.channel() === 'LIVRAISON' ? this.deliveryAddress() || undefined : undefined,
        customerPhone: this.customerPhone() || undefined,
      };

      const orderEdited = this.createOrderEvent(
        updatedOrder,
        'OrderEdited',
        updatedOrder.version,
        {
          orderId: editingOrderId,
          orderNumber: updatedOrder.orderNumber,
          lines: updatedOrder.lines,
          total,
          cashierId: user.id,
          status: 'PREPARED',
        },
        Date.now(),
      );

      const kitchenTicketReprinted = this.createOrderEvent(
        updatedOrder,
        'KitchenTicketPrinted',
        updatedOrder.version + 1,
        {
          orderId: editingOrderId,
          orderNumber: updatedOrder.orderNumber,
          printerTarget: 'KITCHEN',
          printedAt: now,
          reprint: true,
        },
        Date.now() + 1,
      );

      await this.db.transaction('rw', this.db.completedOrders, this.db.eventQueue, async () => {
        await this.db.completedOrders.put(updatedOrder);
        await this.db.eventQueue.bulkPut([orderEdited, kitchenTicketReprinted]);
      });

      this.lastOrder.set(updatedOrder);
      this.cart.set([]);
      this.editingPreparedOrderId.set(null);

      return updatedOrder;
    }

    const orderId = crypto.randomUUID();
    const channel = this.channel();
    const order: CompletedOrder = {
      id: orderId,
      orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
      branchId: branch.branchId,
      cashierName: user.displayName,
      total,
      currency: 'MAD',
      paymentMethod: 'UNPAID',
      status: 'PREPARED',
      channel,
      tableNumber: channel === 'SUR_PLACE' ? this.selectedTableNumber() || undefined : undefined,
      livreurId: channel === 'LIVRAISON' ? this.selectedLivreurId() || undefined : undefined,
      deliveryAddress: channel === 'LIVRAISON' ? this.deliveryAddress() || undefined : undefined,
      customerPhone: this.customerPhone() || undefined,
      lineCount: this.cart().length,
      lines: this.cart().map((line) => ({ ...line })),
      createdAt: now,
      kitchenPrintedAt: now,
      lastUpdatedAt: now,
      version: 2,
    };

    const orderCreated = this.createOrderEvent(
      order,
      'OrderCreated',
      1,
      {
        orderId,
        orderNumber: order.orderNumber,
        lines: order.lines,
        total,
        cashierId: user.id,
        status: 'PREPARED',
      },
      Date.now(),
    );

    const kitchenTicketPrinted = this.createOrderEvent(
      order,
      'KitchenTicketPrinted',
      2,
      {
        orderId,
        orderNumber: order.orderNumber,
        printerTarget: 'KITCHEN',
        printedAt: now,
      },
      Date.now() + 1,
    );

    await this.db.transaction('rw', this.db.completedOrders, this.db.eventQueue, async () => {
      await this.db.completedOrders.put(order);
      await this.db.eventQueue.bulkPut([orderCreated, kitchenTicketPrinted]);
    });

    this.lastOrder.set(order);
    this.cart.set([]);

    return order;
  }

  async payPreparedOrder(orderId: string, paymentMethod: PaymentMethod): Promise<CompletedOrder | null> {
    const storedOrder = await this.db.completedOrders.get(orderId);
    const user = this.session.user();
    const existing = storedOrder ? this.normalizeOrder(storedOrder) : null;

    if (!existing || existing.status === 'PAID' || !user) {
      return null;
    }

    const paidAt = new Date().toISOString();
    const updatedOrder: CompletedOrder = {
      ...existing,
      paymentMethod,
      status: 'PAID',
      paidAt,
      lastUpdatedAt: paidAt,
      version: existing.version + 1,
    };

    const paymentReceived = this.createOrderEvent(
      updatedOrder,
      'PaymentReceived',
      updatedOrder.version,
      {
        orderId,
        total: updatedOrder.total,
        paymentMethod,
        paidAt,
        cashierId: user.id,
      },
      Date.now(),
    );

    await this.db.transaction('rw', this.db.completedOrders, this.db.eventQueue, async () => {
      await this.db.completedOrders.put(updatedOrder);
      await this.db.eventQueue.put(paymentReceived);
    });

    this.lastOrder.set(updatedOrder);
    return updatedOrder;
  }

  async getPendingQueueDepth(): Promise<number> {
    return this.db.eventQueue.where('localStatus').equals('pending').count();
  }

  async listCompletedOrders(branchId?: string): Promise<CompletedOrder[]> {
    const orders = branchId
      ? await this.db.completedOrders.where('branchId').equals(branchId).toArray()
      : await this.db.completedOrders.toArray();

    return orders
      .map((order) => this.normalizeOrder(order))
      .sort((left, right) => right.lastUpdatedAt.localeCompare(left.lastUpdatedAt));
  }

  async reopenPreparedOrder(orderId: string): Promise<boolean> {
    const storedOrder = await this.db.completedOrders.get(orderId);
    const order = storedOrder ? this.normalizeOrder(storedOrder) : null;
    if (!order || order.status !== 'PREPARED') {
      return false;
    }

    this.cart.set(order.lines.map((line) => ({ ...line })));
    this.paymentMethod.set('CASH');
    this.editingPreparedOrderId.set(orderId);
    this.lastOrder.set(order);
    this.channel.set(order.channel);
    this.selectedTableNumber.set(order.tableNumber ?? '');
    this.selectedLivreurId.set(order.livreurId ?? '');
    this.deliveryAddress.set(order.deliveryAddress ?? '');
    this.customerPhone.set(order.customerPhone ?? '');
    await this.router.navigateByUrl('/pos');
    return true;
  }

  private createOrderEvent(
    order: CompletedOrder,
    eventType: string,
    aggregateVersion: number,
    payload: Record<string, unknown>,
    deviceSequence: number,
  ): QueueEntry {
    const user = this.session.user();
    const branch = this.session.branch();

    if (!user || !branch) {
      throw new Error('Cannot create order event without active session');
    }

    return this.createQueueEntry({
      eventUuid: crypto.randomUUID(),
      tenantId: user.tenantId,
      branchId: order.branchId,
      deviceId: branch.deviceCode,
      deviceSequence,
      timestamp: order.lastUpdatedAt,
      eventType,
      aggregateType: 'ORDER',
      aggregateId: order.id,
      aggregateVersion,
      schemaVersion: 1,
      status: 'PENDING',
      correlationId: order.id,
      causationId: order.id,
      payload,
    });
  }

  private createQueueEntry(envelope: SyncEventEnvelope): QueueEntry {
    return {
      ...envelope,
      localStatus: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
  }

  private normalizeOrder(order: CompletedOrder): CompletedOrder {
    const lines = order.lines ?? [];
    const paymentMethod = order.paymentMethod === 'CARD' || order.paymentMethod === 'CASH'
      ? order.paymentMethod
      : 'UNPAID';
    const status = order.status ?? (paymentMethod === 'UNPAID' ? 'PREPARED' : 'PAID');
    const createdAt = order.createdAt ?? new Date().toISOString();
    const lastUpdatedAt = order.lastUpdatedAt ?? order.paidAt ?? order.kitchenPrintedAt ?? createdAt;
    const channel: OrderChannel =
      order.channel === 'SUR_PLACE' || order.channel === 'EMPORTER' || order.channel === 'LIVRAISON'
        ? order.channel
        : 'SUR_PLACE';

    return {
      ...order,
      cashierName: order.cashierName || 'Unknown operator',
      paymentMethod,
      status,
      channel,
      lineCount: order.lineCount ?? lines.length,
      lines,
      createdAt,
      kitchenPrintedAt: order.kitchenPrintedAt ?? createdAt,
      lastUpdatedAt,
      version: order.version ?? (status === 'PAID' ? 3 : 2),
    };
  }
}
