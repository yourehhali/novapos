import { Injectable, inject, signal } from '@angular/core';
import {
  CompletedOrder,
  PocketIncomingOrder,
  PosWsCatalogPayload,
  PosWsClientStatus,
  PosWsConfigPatch,
  PosWsConfigView,
  PosWsIncomingOrder,
  PosWsLogEntry,
  PosWsOrderCreatedPayload,
  PosWsOrderResultPayload,
  PosWsOrdersSyncEntry,
  PosWsSnapshot,
  PosWsSnapshotRequest,
} from '../models/app.models';
import { RoxPosDbService } from '../../offline/RoxPos-db.service';
import { BusinessSettingsService } from './business-settings.service';
import { DesktopBridgeService } from './desktop-bridge.service';
import { PosService } from './pos.service';
import { ReceiptService } from './receipt.service';
import { SessionService } from './session.service';
import { SyncService } from './sync.service';
import { WorkspaceService } from './workspace.service';

const RENDERER_LOG_LIMIT = 100;
const SNAPSHOT_ORDER_LIMIT = 200;
const WEBSITE_SOURCE = 'WEBSITE';
const WEBSITE_DEVICE_ID = 'almani-nafris-web';
const WEBSITE_DEVICE_LABEL = 'Site almani-nafris.com';

/**
 * Renderer side of the almani-nafris.com integration.
 *
 * The WebSocket transport lives in the Electron main process so the connection
 * survives screen changes. This service owns everything that needs the POS data:
 * the product catalog pushed to the website, and turning website orders into
 * regular POS orders (reusing `PosService.createExternalOrder`), printing and
 * the existing sync queue.
 */
@Injectable({ providedIn: 'root' })
export class WebsocketPosService {
  private readonly bridge = inject(DesktopBridgeService);
  private readonly workspace = inject(WorkspaceService);
  private readonly businessSettings = inject(BusinessSettingsService);
  private readonly db = inject(RoxPosDbService);
  private readonly pos = inject(PosService);
  private readonly receipt = inject(ReceiptService);
  private readonly sync = inject(SyncService);
  private readonly session = inject(SessionService);

  /** Log entries produced while processing website orders in the renderer. */
  readonly processingLogs = signal<PosWsLogEntry[]>([]);

  private initialized = false;
  private readonly inFlightOrders = new Map<string, Promise<PosWsOrderResultPayload>>();

  init(): void {
    if (this.initialized || !this.bridge.isDesktop()) {
      return;
    }
    this.initialized = true;

    this.bridge.onWsOrder((request) => {
      void this.handleIncomingOrder(request);
    });

    this.bridge.onWsSnapshotRequest((request) => {
      void this.handleSnapshotRequest(request);
    });

    this.workspace.catalogChanged$.subscribe(() => void this.pushCatalog());
    this.workspace.businessSettingsChanged$.subscribe(() => void this.pushCatalog());

    void this.pushCatalog();
  }

  getStatus(): Promise<PosWsClientStatus | null> {
    return this.bridge.getWsStatus();
  }

  getConfig(): Promise<PosWsConfigView | null> {
    return this.bridge.getWsConfig();
  }

  updateConfig(patch: PosWsConfigPatch): Promise<PosWsClientStatus | null> {
    return this.bridge.setWsConfig(patch);
  }

  connect(): Promise<PosWsClientStatus | null> {
    return this.bridge.connectWs();
  }

  disconnect(): Promise<PosWsClientStatus | null> {
    return this.bridge.disconnectWs();
  }

  getTransportLogs(): Promise<PosWsLogEntry[]> {
    return this.bridge.getWsLogs();
  }

  /** Rebuilds the catalog (with version + hash) and pushes it to the transport. */
  async pushCatalog(): Promise<void> {
    if (!this.bridge.isDesktop()) {
      return;
    }
    const catalog = await this.buildCatalogPayload();
    await this.bridge.pushWsCatalog(catalog);
  }

  private async buildCatalogPayload(): Promise<PosWsCatalogPayload> {
    const [catalog, settings, branch] = await Promise.all([
      this.workspace.loadCatalog(),
      this.businessSettings.load(),
      Promise.resolve(this.session.branch()),
    ]);

    const products = [...catalog.products]
      .map((product) => ({
        id: product.id,
        name: product.name,
        categoryId: product.categoryId,
        price: product.price,
        currency: product.currency || settings.currency,
        sku: product.sku,
        available: product.available !== false,
      }))
      .sort((left, right) => left.id.localeCompare(right.id));

    const categories = [...catalog.categories]
      .map((category) => ({ id: category.id, name: category.name }))
      .sort((left, right) => left.id.localeCompare(right.id));

    const hash = hashCatalogProducts(products);
    const version = await this.nextCatalogVersion(hash);

    return {
      branchId: branch?.branchId ?? '',
      version,
      hash,
      currency: settings.currency,
      categories,
      products,
    };
  }

  /**
   * Bumps the catalog version only when the product fingerprint changed, so a
   * reconnect can be answered with "nothing new" instead of re-sending
   * everything.
   */
  private async nextCatalogVersion(hash: string): Promise<number> {
    const existing = await this.db.posWsState.get('current');
    if (existing && existing.catalogHash === hash) {
      return existing.catalogVersion;
    }

    const version = (existing?.catalogVersion ?? 0) + 1;
    await this.db.posWsState.put({
      id: 'current',
      catalogVersion: version,
      catalogHash: hash,
      updatedAt: new Date().toISOString(),
    });
    return version;
  }

  private async handleSnapshotRequest(request: PosWsSnapshotRequest): Promise<void> {
    try {
      const catalog = await this.buildCatalogPayload();
      const processed = await this.db.posWsEvents.orderBy('processedAt').reverse().limit(SNAPSHOT_ORDER_LIMIT).toArray();
      const snapshot: PosWsSnapshot = {
        catalog,
        orders: processed.map<PosWsOrdersSyncEntry>((entry) => ({
          eventId: entry.eventId,
          orderId: entry.orderId,
          orderNumber: entry.orderNumber,
          total: entry.total,
          channel: entry.channel,
          createdAt: entry.processedAt,
        })),
      };
      await this.bridge.resolveWsSnapshot(request.requestId, snapshot);
    } catch {
      await this.bridge.resolveWsSnapshot(request.requestId, { catalog: null, orders: [] });
    }
  }

  private async handleIncomingOrder(request: PosWsIncomingOrder): Promise<void> {
    const result = await this.processOnce(request.eventId, request.order);
    await this.bridge.resolveWsOrder(request.eventId, result);
  }

  /**
   * Serializes processing per website event id. A retry that arrives while the
   * first attempt is still running reuses its result instead of creating a
   * second order.
   */
  private processOnce(
    eventId: string,
    order: PosWsOrderCreatedPayload,
  ): Promise<PosWsOrderResultPayload> {
    const pending = this.inFlightOrders.get(eventId);
    if (pending) {
      return pending;
    }

    const task = this.processOrder(eventId, order).finally(() => this.inFlightOrders.delete(eventId));
    this.inFlightOrders.set(eventId, task);
    return task;
  }

  private async processOrder(
    eventId: string,
    order: PosWsOrderCreatedPayload,
  ): Promise<PosWsOrderResultPayload> {
    try {
      const processed = await this.db.posWsEvents.get(eventId);
      if (processed) {
        this.log('INFO', `Événement ${eventId} déjà traité: acquittement rejoué pour ${processed.orderNumber}.`);
        return {
          ok: true,
          orderId: processed.orderId,
          orderNumber: processed.orderNumber,
          total: processed.total,
        };
      }

      const request = this.toPocketRequest(eventId, order);
      const inspection = await this.pos.inspectExternalOrder(request);
      if (!inspection.ok) {
        this.log('WARN', `Commande refusée (${inspection.code}): ${inspection.message}`);
        return {
          ok: false,
          code: inspection.code,
          message: inspection.message,
          productIds: inspection.productIds,
        };
      }

      if (order.channel === 'LIVRAISON') {
        const drivers = (await this.pos.listDeliveryDrivers()).filter((driver) => driver.status === 'ACTIVE');
        this.log(
          drivers.length > 0 ? 'INFO' : 'WARN',
          drivers.length > 0
            ? `Livraison du site: ${drivers.length} livreur(s) actif(s), affectation manuelle depuis la caisse.`
            : 'Livraison du site sans affectation: aucun livreur actif.',
        );
      }

      const created = await this.pos.createExternalOrder(request, {
        dedupe: { eventId, source: WEBSITE_SOURCE },
      });
      if (!created) {
        this.log('ERROR', `Création de commande impossible pour l'événement ${eventId}.`);
        return { ok: false, code: 'internal_error', message: 'Création de commande impossible.' };
      }

      // Printing is deliberately decoupled: a printer failure must never reject
      // an order that is already durably stored.
      await this.printKitchen(created);
      this.sync.scheduleSync(100);
      this.log('INFO', `Commande ${created.orderNumber} créée depuis le site (${created.total} ${created.currency}).`);

      return {
        ok: true,
        orderId: created.id,
        orderNumber: created.orderNumber,
        total: created.total,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue.';
      this.log('ERROR', `Échec du traitement de la commande: ${message}`);
      return { ok: false, code: 'internal_error', message };
    }
  }

  private async printKitchen(order: CompletedOrder): Promise<void> {
    try {
      const printed = await this.receipt.printKitchenTicket(order);
      if (!printed) {
        this.log('WARN', `Ticket cuisine non imprimé pour ${order.orderNumber}.`);
      }
    } catch (error) {
      this.log(
        'ERROR',
        `Erreur d'impression cuisine pour ${order.orderNumber}: ${error instanceof Error ? error.message : 'inconnue'}`,
      );
    }
  }

  private toPocketRequest(eventId: string, order: PosWsOrderCreatedPayload): PocketIncomingOrder {
    return {
      requestId: `ws-${eventId}`,
      channel: order.channel,
      tableNumber: order.channel === 'SUR_PLACE' ? order.tableNumber : undefined,
      // The website must never assign drivers: any external id is ignored and
      // the POS keeps ownership of delivery assignment.
      livreurId: undefined,
      customerPhone: order.customerPhone,
      deliveryAddress: order.channel === 'LIVRAISON' ? order.deliveryAddress : undefined,
      note: order.note,
      lines: order.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      deviceId: WEBSITE_DEVICE_ID,
      deviceLabel: WEBSITE_DEVICE_LABEL,
    };
  }

  private log(level: PosWsLogEntry['level'], message: string): void {
    const entry: PosWsLogEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      at: new Date().toISOString(),
      level,
      message,
    };
    this.processingLogs.set([entry, ...this.processingLogs()].slice(0, RENDERER_LOG_LIMIT));
  }
}

/** Deterministic FNV-1a fingerprint of the catalog product list. */
function hashCatalogProducts(products: PosWsCatalogPayload['products']): string {
  const canonical = JSON.stringify(
    products.map((product) => ({
      id: product.id,
      name: product.name,
      categoryId: product.categoryId,
      price: product.price,
      available: product.available !== false,
    })),
  );
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
