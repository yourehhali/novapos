import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NovaPosDbService } from '../../offline/novapos-db.service';
import {
  CompletedOrder,
  PaymentMethod,
  PosLine,
  Product,
  QueueEntry,
  SyncEventEnvelope,
} from '../models/app.models';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class PosService {
  private readonly db = inject(NovaPosDbService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  readonly cart = signal<PosLine[]>([]);
  readonly paymentMethod = signal<'CASH' | 'CARD'>('CASH');
  readonly lastOrder = signal<CompletedOrder | null>(null);
  readonly editingPreparedOrderId = signal<string | null>(null);

  readonly subtotal = computed(() =>
    this.cart().reduce((sum, line) => sum + line.total, 0),
  );

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
    this.editingPreparedOrderId.set(null);
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
    const order: CompletedOrder = {
      id: orderId,
      orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
      branchId: branch.branchId,
      cashierName: user.displayName,
      total,
      currency: 'MAD',
      paymentMethod: 'UNPAID',
      status: 'PREPARED',
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

    return {
      ...order,
      cashierName: order.cashierName || 'Unknown operator',
      paymentMethod,
      status,
      lineCount: order.lineCount ?? lines.length,
      lines,
      createdAt,
      kitchenPrintedAt: order.kitchenPrintedAt ?? createdAt,
      lastUpdatedAt,
      version: order.version ?? (status === 'PAID' ? 3 : 2),
    };
  }
}
