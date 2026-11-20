import { Injectable, inject } from '@angular/core';
import {
  CompletedOrder,
  PocketCatalogPayload,
  PocketHistoryPayload,
  PocketHistoryRequest,
  PocketIncomingOrder,
  PocketOrderSummary,
  PocketPayRequest,
  PocketServerStatus,
  PocketStats,
} from '../models/app.models';
import { BusinessSettingsService } from './business-settings.service';
import { DesktopBridgeService } from './desktop-bridge.service';
import { PosService } from './pos.service';
import { ReceiptService } from './receipt.service';
import { SyncService } from './sync.service';
import { WorkspaceService } from './workspace.service';

/**
 * Bridges the LAN pocket server (hosted by the Electron main process) with the
 * renderer: keeps the shared catalog in sync and turns orders pushed from
 * paired phones into local orders that the desktop prints and handles as usual.
 */
@Injectable({ providedIn: 'root' })
export class PocketService {
  private readonly bridge = inject(DesktopBridgeService);
  private readonly workspace = inject(WorkspaceService);
  private readonly pos = inject(PosService);
  private readonly receipt = inject(ReceiptService);
  private readonly sync = inject(SyncService);
  private readonly businessSettings = inject(BusinessSettingsService);

  private initialized = false;

  init(): void {
    if (this.initialized || !this.bridge.isDesktop()) {
      return;
    }
    this.initialized = true;

    this.bridge.onPocketOrder((order) => {
      void this.handleIncomingOrder(order);
    });

    this.bridge.onPocketPay((request) => {
      void this.handleIncomingPay(request);
    });

    this.bridge.onPocketHistory((request) => {
      void this.handleIncomingHistory(request);
    });

    this.workspace.catalogChanged$.subscribe(() => void this.pushCatalog());
    this.workspace.tablesChanged$.subscribe(() => void this.pushCatalog());
    this.workspace.driversChanged$.subscribe(() => void this.pushCatalog());
    this.workspace.businessSettingsChanged$.subscribe(() => void this.pushCatalog());

    void this.pushCatalog();
  }

  getStatus(): Promise<PocketServerStatus | null> {
    return this.bridge.getPocketStatus();
  }

  async startServer(): Promise<PocketServerStatus | null> {
    await this.pushCatalog();
    return this.bridge.startPocketServer();
  }

  stopServer(): Promise<PocketServerStatus | null> {
    return this.bridge.stopPocketServer();
  }

  regeneratePin(): Promise<PocketServerStatus | null> {
    return this.bridge.regeneratePocketPin();
  }

  async pushCatalog(): Promise<void> {
    if (!this.bridge.isDesktop()) {
      return;
    }

    const [catalog, tables, drivers, settings] = await Promise.all([
      this.workspace.loadCatalog(),
      this.pos.listFloorTables(),
      this.pos.listDeliveryDrivers(),
      this.businessSettings.load(),
    ]);

    const payload: PocketCatalogPayload = {
      businessName: settings.businessName,
      currency: settings.currency,
      categories: catalog.categories,
      products: catalog.products.filter((product) => product.available !== false),
      tables: tables.filter((table) => table.status === 'ACTIVE'),
      drivers: drivers.filter((driver) => driver.status === 'ACTIVE'),
    };

    await this.bridge.pushPocketData(payload);
  }

  private async handleIncomingOrder(request: PocketIncomingOrder): Promise<void> {
    try {
      const order = await this.pos.createExternalOrder(request);
      if (!order) {
        await this.bridge.resolvePocketOrder(request.requestId, {
          ok: false,
          error: 'Aucun produit disponible dans cette commande.',
        });
        return;
      }

      await this.receipt.printKitchenTicket(order);
      this.sync.scheduleSync(100);

      await this.bridge.resolvePocketOrder(request.requestId, {
        ok: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
      });
    } catch (error) {
      await this.bridge.resolvePocketOrder(request.requestId, {
        ok: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  }

  /**
   * Settles a pocket order: marks it PAID on the desktop, prints the payment
   * ticket (which also opens the cash drawer) and resolves back to the phone.
   */
  private async handleIncomingPay(request: PocketPayRequest): Promise<void> {
    try {
      const order = await this.pos.payPreparedOrder(request.orderId, request.paymentMethod);
      if (!order) {
        await this.bridge.resolvePocketPay(request.requestId, {
          ok: false,
          error: 'Commande introuvable ou deja payee.',
        });
        return;
      }

      await this.receipt.printPaymentTicket(order);
      this.sync.scheduleSync(100);

      await this.bridge.resolvePocketPay(request.requestId, {
        ok: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        printed: true,
      });
    } catch (error) {
      await this.bridge.resolvePocketPay(request.requestId, {
        ok: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  }

  /**
   * Returns the orders pushed by this pocket device together with its personal
   * stats. Identity is the device label only (see project decision), so orders
   * are grouped by the label shown when the device paired.
   */
  private async handleIncomingHistory(request: PocketHistoryRequest): Promise<void> {
    const label = request.deviceLabel?.trim();
    const empty: PocketHistoryPayload = {
      orders: [],
      stats: { orderCount: 0, paidCount: 0, unpaidCount: 0, totalCollected: 0, currency: '' },
    };

    try {
      if (!label) {
        await this.bridge.resolvePocketHistory(request.requestId, empty);
        return;
      }

      const settings = await this.businessSettings.load();
      const allOrders = await this.pos.listCompletedOrders();
      const deviceOrders = allOrders.filter(
        (order) => (order.deviceLabel ?? '').trim() === label,
      );

      const stats: PocketStats = {
        orderCount: deviceOrders.length,
        paidCount: deviceOrders.filter((order) => order.status === 'PAID').length,
        unpaidCount: deviceOrders.filter((order) => order.status !== 'PAID').length,
        totalCollected: deviceOrders
          .filter((order) => order.status === 'PAID')
          .reduce((sum, order) => sum + order.total, 0),
        currency: settings.currency,
      };

      await this.bridge.resolvePocketHistory(request.requestId, {
        orders: deviceOrders.slice(0, 100).map((order) => toPocketOrderSummary(order)),
        stats,
      });
    } catch {
      await this.bridge.resolvePocketHistory(request.requestId, empty);
    }
  }
}

function toPocketOrderSummary(order: CompletedOrder): PocketOrderSummary {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    channel: order.channel,
    status: order.status,
    paymentMethod: order.paymentMethod,
    total: order.total,
    currency: order.currency,
    tableNumber: order.tableNumber,
    lineCount: order.lineCount,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
  };
}
