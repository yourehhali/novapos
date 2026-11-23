import { randomUUID } from 'node:crypto';
import {
  buildEnvelope,
  encodeEnvelope,
  parseEnvelope,
  parseOrderCreatedPayload,
  POS_WS_PROTOCOL_VERSION,
  type PosWsCatalogPayload,
  type PosWsConnectionState,
  type PosWsConnectionStatusPayload,
  type PosWsEnvelope,
  type PosWsOrderAckPayload,
  type PosWsOrderCreatedPayload,
  type PosWsOrderErrorPayload,
  type PosWsOrderErrorCode,
  type PosWsOrdersSyncEntry,
  type PosWsProductAckPayload,
} from './ws-protocol';
import { WsTransport } from './ws-transport';

export const DEFAULT_POS_WS_URL = 'wss://almani-nafris.com/api/pos/ws';

const HEARTBEAT_INTERVAL_MS = 25000;
const HEARTBEAT_TIMEOUT_MS = 10000;
const SYNC_TIMEOUT_MS = 8000;
const ORDER_TIMEOUT_MS = 20000;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 60000;
/** A connection must stay up this long before the reconnect backoff is reset. */
const STABLE_CONNECTION_MS = 30000;
const MAX_LOG_ENTRIES = 200;

export type PosWsOrderResultPayload = PosWsOrderAckPayload | PosWsOrderErrorPayload;

export interface PosWsClientConfig {
  enabled: boolean;
  url: string;
  token: string;
  branchId: string | null;
  deviceId: string | null;
  tenantId: string | null;
  posVersion: string;
}

export interface PosWsSnapshot {
  catalog: PosWsCatalogPayload | null;
  orders: PosWsOrdersSyncEntry[];
}

export interface PosWsLogEntry {
  id: string;
  at: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  detail?: string;
}

export interface PosWsClientStatus {
  enabled: boolean;
  state: PosWsConnectionState;
  url: string;
  connectedAt: string | null;
  lastMessageAt: string | null;
  lastError: string | null;
  reconnectAttempt: number;
  catalogVersion: number | null;
  catalogHash: string | null;
  ackedCatalogVersion: number | null;
  pendingOrders: number;
}

export interface PosWsClientOptions {
  config: PosWsClientConfig;
  /** Creates the POS order from a website order and returns the ack/error payload. */
  handleOrder: (eventId: string, order: PosWsOrderCreatedPayload) => Promise<PosWsOrderResultPayload>;
  /** Renderer-side catalog + processed-order snapshot used for reconnect resync. */
  requestSnapshot: () => Promise<PosWsSnapshot>;
  onStatus: (status: PosWsClientStatus) => void;
  onLog?: (entry: PosWsLogEntry) => void;
}

export class PosWsClient {
  private transport: WsTransport | null = null;
  private config: PosWsClientConfig;
  private readonly logs: PosWsLogEntry[] = [];

  private state: PosWsConnectionState = 'DISCONNECTED';
  private connectedAt: string | null = null;
  private connectedAtMs: number | null = null;
  private lastMessageAt: string | null = null;
  private lastError: string | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatDeadline: ReturnType<typeof setTimeout> | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private stoppedByUser = false;
  private authenticating = false;

  private catalog: PosWsCatalogPayload | null = null;
  private ackedCatalogVersion: number | null = null;
  private pendingOrders = 0;

  constructor(private readonly options: PosWsClientOptions) {
    this.config = { ...options.config };
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  status(): PosWsClientStatus {
    return {
      enabled: this.config.enabled,
      state: this.state,
      url: this.config.url || DEFAULT_POS_WS_URL,
      connectedAt: this.connectedAt,
      lastMessageAt: this.lastMessageAt,
      lastError: this.lastError,
      reconnectAttempt: this.reconnectAttempt,
      catalogVersion: this.catalog?.version ?? null,
      catalogHash: this.catalog?.hash ?? null,
      ackedCatalogVersion: this.ackedCatalogVersion,
      pendingOrders: this.pendingOrders,
    };
  }

  getLogs(): PosWsLogEntry[] {
    return [...this.logs];
  }

  updateConfig(config: Partial<PosWsClientConfig>): PosWsClientStatus {
    const previousUrl = this.config.url;
    const previouslyEnabled = this.config.enabled;
    this.config = { ...this.config, ...config };

    if (!this.config.enabled) {
      this.stop();
      return this.status();
    }

    if (!previouslyEnabled || previousUrl !== this.config.url || config.token !== undefined) {
      this.stoppedByUser = false;
      this.resetAndConnect('configuration changed');
    }

    return this.status();
  }

  start(): PosWsClientStatus {
    this.stoppedByUser = false;
    if (!this.config.enabled) {
      this.log('WARN', 'Intégration POS désactivée: aucun connexion ouverte.');
      return this.status();
    }
    // Keep an already healthy connection. Recreating it makes the server see
    // two logins at once and close one with code 1000, which the client then
    // retries — the endless "auth success / 1000" loop.
    if (this.transport?.isOpen()) {
      this.log('INFO', 'Connexion WebSocket déjà active.');
      return this.status();
    }
    this.resetAndConnect('manual start');
    return this.status();
  }

  stop(): PosWsClientStatus {
    this.stoppedByUser = true;
    this.clearTimers();
    this.closeTransport(1000, 'client stop');
    this.authenticating = false;
    this.connectedAtMs = null;
    this.setState(this.config.enabled ? 'DISCONNECTED' : 'DISCONNECTED');
    this.log('INFO', 'Connexion WebSocket arrêtée.');
    return this.status();
  }

  /** Pushes the newest catalog. Sends `products.updated` when already synced. */
  pushCatalog(catalog: PosWsCatalogPayload): void {
    this.catalog = catalog;
    if (!this.isReady()) {
      return;
    }
    if (this.ackedCatalogVersion === catalog.version) {
      return;
    }
    this.sendProductsUpdated(catalog);
  }

  private resetAndConnect(reason: string): void {
    this.clearTimers();
    this.closeTransport(1000, 'reconnect');
    this.authenticating = false;
    this.connectedAtMs = null;
    this.reconnectAttempt = 0;
    this.log('INFO', `Ouverture de la connexion WebSocket (${reason}).`);
    this.connect();
  }

  /**
   * Closes the active transport without letting its `close` event run the
   * reconnect logic. A client-initiated reconnect/stop must not look like a
   * dropped connection, otherwise each close schedules a second reconnect and
   * the client piles up duplicate, self-perpetuating 1000-close reconnects.
   */
  private closeTransport(code: number, reason: string): void {
    const transport = this.transport;
    this.transport = null;
    if (!transport) {
      return;
    }
    transport.removeAllListeners();
    transport.close(code, reason);
  }

  private connect(): void {
    if (this.stoppedByUser || !this.config.enabled) {
      return;
    }
    if (!this.config.token) {
      this.lastError = 'Jeton d\'intégration manquant.';
      this.setState('AUTH_ERROR');
      this.log('ERROR', 'Connexion impossible: jeton d\'intégration manquant.');
      return;
    }

    this.setState('CONNECTING');
    const transport = new WsTransport({ url: this.config.url || DEFAULT_POS_WS_URL });
    this.transport = transport;

    transport.on('open', () => {
      this.log('INFO', `Connecté à ${this.config.url}.`);
      this.sendAuth();
    });

    transport.on('message', (raw: string) => this.handleRawMessage(raw));
    transport.on('pong', () => this.onHeartbeatAlive());

    transport.on('error', (error: Error) => {
      this.lastError = error.message;
      this.log('ERROR', `Erreur WebSocket: ${error.message}`);
    });

    transport.on('close', (info: { code: number; reason: string }) => {
      // A transport that was already replaced (e.g. by a manual reconnect) must
      // not tear down the live connection nor schedule another reconnect.
      if (this.transport !== transport) {
        return;
      }
      this.transport = null;
      this.stopHeartbeat();
      this.authenticating = false;
      const uptimeMs = this.connectedAtMs !== null ? Date.now() - this.connectedAtMs : 0;
      this.connectedAtMs = null;
      this.connectedAt = null;
      if (this.stoppedByUser) {
        this.setState('DISCONNECTED');
        return;
      }
      this.log('WARN', `Connexion fermée (${info.code}${info.reason ? ` ${info.reason}` : ''}).`);
      if (this.state === 'AUTH_ERROR') {
        return;
      }
      // Forget the backoff only once a connection proved stable; otherwise a
      // server that accepts auth then closes normally would be reconnected to
      // every second indefinitely.
      if (uptimeMs >= STABLE_CONNECTION_MS) {
        this.reconnectAttempt = 0;
      }
      this.setState('DISCONNECTED');
      this.scheduleReconnect();
    });

    transport.open();
  }

  private scheduleReconnect(): void {
    if (this.stoppedByUser || !this.config.enabled) {
      return;
    }
    const attempt = this.reconnectAttempt;
    const exponential = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt);
    const jitter = 0.8 + Math.random() * 0.4;
    const delay = Math.round(exponential * jitter);
    this.reconnectAttempt = attempt + 1;
    this.log('INFO', `Nouvelle tentative de connexion dans ${Math.round(delay / 1000)}s.`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
    this.reconnectTimer.unref?.();
  }

  private sendAuth(): void {
    this.authenticating = true;
    const envelope = buildEnvelope('auth', {
      protocolVersion: POS_WS_PROTOCOL_VERSION,
      token: this.config.token,
      tenantId: this.config.tenantId,
      branchId: this.config.branchId,
      deviceId: this.config.deviceId ?? 'unknown-device',
      posVersion: this.config.posVersion,
      channel: 'POS' as const,
    });
    this.sendEnvelope(envelope);
    this.log('INFO', 'Authentification envoyée.');
  }

  private handleRawMessage(raw: string): void {
    this.lastMessageAt = new Date().toISOString();
    this.notifyStatus();

    const parsed = parseEnvelope(raw);
    if (!parsed.ok) {
      this.log('WARN', `Message ignoré (${parsed.reason}).`);
      return;
    }

    const envelope = parsed.envelope;
    switch (envelope.type) {
      case 'auth.success':
        this.onAuthSuccess();
        return;
      case 'auth.error':
        this.onAuthError(envelope.payload as { reason?: string; message?: string });
        return;
      case 'products.ack':
        this.onProductsAck(envelope.payload as unknown as PosWsProductAckPayload);
        return;
      case 'order.created':
        void this.onOrderCreated(envelope);
        return;
      case 'ping':
        this.sendEnvelope(buildEnvelope('pong', { echo: envelope.eventId }));
        return;
      case 'pong':
        this.onHeartbeatAlive();
        return;
      case 'connection.status':
        this.log('INFO', `Statut serveur: ${String((envelope.payload as { state?: unknown }).state ?? 'inconnu')}.`);
        return;
      default:
        this.log('WARN', `Type de message non pris en charge: ${envelope.type}.`);
    }
  }

  private onAuthSuccess(): void {
    this.authenticating = false;
    this.connectedAt = new Date().toISOString();
    this.connectedAtMs = Date.now();
    this.lastError = null;
    this.setState('CONNECTED');
    this.log('INFO', 'Authentification réussie.');
    this.startHeartbeat();
    void this.runResync();
  }

  private onAuthError(payload: { reason?: string; message?: string }): void {
    this.authenticating = false;
    this.lastError = payload.reason ?? payload.message ?? 'Authentification refusée.';
    this.setState('AUTH_ERROR');
    this.log('ERROR', `Authentification refusée: ${this.lastError}`);
    this.transport?.close(1000, 'auth error');
  }

  private async runResync(): Promise<void> {
    this.setState('SYNCHRONIZING');
    try {
      const snapshot = await this.options.requestSnapshot();
      if (snapshot.catalog) {
        this.catalog = snapshot.catalog;
        if (this.ackedCatalogVersion !== snapshot.catalog.version) {
          this.sendProductsSync(snapshot.catalog);
        }
      } else {
        this.log('WARN', 'Catalogue POS indisponible pour la synchronisation initiale.');
      }
      if (snapshot.orders.length > 0) {
        this.sendEnvelope(
          buildEnvelope('orders.sync', {
            branchId: this.config.branchId,
            orders: snapshot.orders,
          }),
        );
        this.log('INFO', `${snapshot.orders.length} commande(s) synchronisée(s) avec le site.`);
      }
    } catch (error) {
      this.log('ERROR', `Synchronisation impossible: ${error instanceof Error ? error.message : 'erreur inconnue'}.`);
    } finally {
      this.armSyncTimeout();
    }
  }

  private armSyncTimeout(): void {
    this.clearSyncTimer();
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      if (this.state === 'SYNCHRONIZING') {
        this.setState('CONNECTED');
      }
    }, SYNC_TIMEOUT_MS);
    this.syncTimer.unref?.();
  }

  private sendProductsSync(catalog: PosWsCatalogPayload): void {
    this.sendEnvelope(
      buildEnvelope('products.sync', {
        branchId: catalog.branchId,
        version: catalog.version,
        hash: catalog.hash,
        currency: catalog.currency,
        categories: catalog.categories,
        products: catalog.products,
      }),
    );
    this.log('INFO', `Catalogue complet envoyé (version ${catalog.version}, ${catalog.products.length} produits).`);
  }

  private sendProductsUpdated(catalog: PosWsCatalogPayload): void {
    this.sendEnvelope(
      buildEnvelope('products.updated', {
        branchId: catalog.branchId,
        version: catalog.version,
        hash: catalog.hash,
        currency: catalog.currency,
        categories: catalog.categories,
        products: catalog.products,
      }),
    );
    this.log('INFO', `Mise à jour catalogue envoyée (version ${catalog.version}).`);
  }

  private onProductsAck(payload: PosWsProductAckPayload): void {
    if (payload?.ok === false) {
      this.log('WARN', `Catalogue refusé par le site: ${payload.reason ?? 'raison inconnue'}.`);
      return;
    }
    this.ackedCatalogVersion = typeof payload?.version === 'number' ? payload.version : this.catalog?.version ?? null;
    this.log('INFO', `Catalogue confirmé (version ${this.ackedCatalogVersion ?? '?'}).`);
    this.clearSyncTimer();
    if (this.state === 'SYNCHRONIZING') {
      this.setState('CONNECTED');
    }
  }

  private async onOrderCreated(envelope: PosWsEnvelope<Record<string, unknown>>): Promise<void> {
    const parsed = parseOrderCreatedPayload(envelope.payload);
    if (!parsed.ok) {
      this.log('WARN', `Commande refusée (${parsed.code}).`);
      this.sendOrderError(envelope.eventId, parsed.code, parsed.message, parsed.productIds);
      return;
    }

    this.pendingOrders += 1;
    this.notifyStatus();
    const timeout = new Promise<PosWsOrderResultPayload>((resolve) => {
      const timer = setTimeout(
        () => resolve({ ok: false, code: 'processing_timeout', message: 'Délai de traitement dépassé.' }),
        ORDER_TIMEOUT_MS,
      );
      timer.unref?.();
    });

    let result: PosWsOrderResultPayload;
    try {
      result = await Promise.race([
        this.options.handleOrder(envelope.eventId, parsed.order),
        timeout,
      ]);
    } catch (error) {
      result = {
        ok: false,
        code: 'internal_error',
        message: error instanceof Error ? error.message : 'Erreur interne.',
      };
    } finally {
      this.pendingOrders = Math.max(0, this.pendingOrders - 1);
      this.notifyStatus();
    }

    if (result.ok) {
      this.log('INFO', `Commande ${result.orderNumber} créée depuis le site.`);
      this.sendEnvelope({
        type: 'order.ack',
        eventId: envelope.eventId,
        timestamp: new Date().toISOString(),
        payload: result,
      });
      return;
    }

    this.log('WARN', `Commande refusée: ${result.code} (${result.message}).`);
    this.sendOrderError(envelope.eventId, result.code, result.message, result.productIds);
  }

  private sendOrderError(
    eventId: string,
    code: PosWsOrderErrorCode,
    message: string,
    productIds?: string[],
  ): void {
    this.sendEnvelope({
      type: 'order.error',
      eventId,
      timestamp: new Date().toISOString(),
      payload: { ok: false, code, message, productIds },
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.isReady()) {
        return;
      }
      this.sendEnvelope(buildEnvelope('ping', { at: new Date().toISOString() }));
      this.heartbeatDeadline = setTimeout(() => {
        this.heartbeatDeadline = null;
        this.log('WARN', 'Aucune réponse au heartbeat: reconnexion.');
        this.transport?.close(4000, 'heartbeat timeout');
      }, HEARTBEAT_TIMEOUT_MS);
      this.heartbeatDeadline.unref?.();
    }, HEARTBEAT_INTERVAL_MS);
    this.heartbeatTimer.unref?.();
  }

  private onHeartbeatAlive(): void {
    if (this.heartbeatDeadline) {
      clearTimeout(this.heartbeatDeadline);
      this.heartbeatDeadline = null;
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.onHeartbeatAlive();
  }

  private clearSyncTimer(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private clearTimers(): void {
    this.stopHeartbeat();
    this.clearSyncTimer();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private isReady(): boolean {
    return this.transport?.isOpen() === true && (this.state === 'CONNECTED' || this.state === 'SYNCHRONIZING');
  }

  private sendEnvelope(envelope: PosWsEnvelope<unknown>): void {
    if (!this.transport?.isOpen()) {
      return;
    }
    const ok = this.transport.send(encodeEnvelope(envelope));
    if (!ok) {
      this.log('WARN', `Échec d'envoi du message ${envelope.type}.`);
    }
  }

  private setState(state: PosWsConnectionState): void {
    this.state = state;
    this.notifyStatus();
    if (this.transport?.isOpen()) {
      const payload: PosWsConnectionStatusPayload = {
        state,
        at: new Date().toISOString(),
        catalogVersion: this.catalog?.version,
      };
      this.sendEnvelope(buildEnvelope('connection.status', payload));
    }
  }

  private notifyStatus(): void {
    this.options.onStatus(this.status());
  }

  private log(level: PosWsLogEntry['level'], message: string, detail?: string): void {
    const entry: PosWsLogEntry = {
      id: randomUUID(),
      at: new Date().toISOString(),
      level,
      message,
      detail,
    };
    this.logs.push(entry);
    if (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs.splice(0, this.logs.length - MAX_LOG_ENTRIES);
    }
    this.options.onLog?.(entry);
  }
}
