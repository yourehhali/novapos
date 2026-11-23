import { randomUUID } from 'node:crypto';

/**
 * Shared WebSocket protocol contract between the POS (client) and the
 * almani-nafris.com website (server). The same envelope is used in both
 * directions. Internal POS events keep using `SyncEventEnvelope` and are never
 * reused as transport messages.
 */

export const POS_WS_PROTOCOL_VERSION = 1;

export type PosWsMessageType =
  | 'auth'
  | 'auth.success'
  | 'auth.error'
  | 'products.sync'
  | 'products.updated'
  | 'products.ack'
  | 'order.created'
  | 'order.ack'
  | 'order.error'
  | 'orders.sync'
  | 'ping'
  | 'pong'
  | 'connection.status';

export interface PosWsEnvelope<T = unknown> {
  type: PosWsMessageType;
  eventId: string;
  timestamp: string;
  payload: T;
}

export type PosWsConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'SYNCHRONIZING'
  | 'AUTH_ERROR';

export type PosWsOrderChannel = 'SUR_PLACE' | 'EMPORTER' | 'LIVRAISON';

export type PosWsOrderErrorCode =
  | 'invalid_payload'
  | 'empty_order'
  | 'unknown_product'
  | 'product_unavailable'
  | 'session_unavailable'
  | 'day_closed'
  | 'pos_unavailable'
  | 'processing_timeout'
  | 'internal_error';

export interface PosWsAuthPayload {
  protocolVersion: number;
  token: string;
  tenantId: string | null;
  branchId: string | null;
  deviceId: string;
  posVersion: string;
  channel: 'POS';
}

export interface PosWsAuthResultPayload {
  ok: boolean;
  serverTime?: string;
  reason?: string;
  code?: string;
}

export interface PosWsCategoryPayload {
  id: string;
  name: string;
}

export interface PosWsProductPayload {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  currency: string;
  sku: string;
  available: boolean;
}

export interface PosWsCatalogPayload {
  branchId: string;
  version: number;
  hash: string;
  currency: string;
  categories: PosWsCategoryPayload[];
  products: PosWsProductPayload[];
}

export interface PosWsProductAckPayload {
  version: number;
  hash: string;
  ok: boolean;
  reason?: string;
}

export interface PosWsOrderLinePayload {
  productId: string;
  quantity: number;
}

export interface PosWsOrderCreatedPayload {
  channel: PosWsOrderChannel;
  tableNumber?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  note?: string;
  lines: PosWsOrderLinePayload[];
}

export interface PosWsOrderAckPayload {
  ok: true;
  orderId: string;
  orderNumber: string;
  total: number;
}

export interface PosWsOrderErrorPayload {
  ok: false;
  code: PosWsOrderErrorCode;
  message: string;
  productIds?: string[];
}

export interface PosWsOrdersSyncEntry {
  eventId: string;
  orderId: string;
  orderNumber: string;
  total: number;
  channel: PosWsOrderChannel;
  createdAt: string;
}

export interface PosWsOrdersSyncPayload {
  branchId: string;
  orders: PosWsOrdersSyncEntry[];
}

export interface PosWsConnectionStatusPayload {
  state: PosWsConnectionState;
  at: string;
  catalogVersion?: number;
  reason?: string;
}

export function buildEnvelope<T>(type: PosWsMessageType, payload: T): PosWsEnvelope<T> {
  return {
    type,
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    payload,
  };
}

export function encodeEnvelope(envelope: PosWsEnvelope<unknown>): string {
  return JSON.stringify(envelope);
}

export type ParseEnvelopeResult =
  | { ok: true; envelope: PosWsEnvelope<Record<string, unknown>> }
  | { ok: false; reason: string };

/**
 * Validates the shared envelope. Returns the parsed message or a machine
 * readable reason so callers can log/ignore malformed traffic.
 */
export function parseEnvelope(raw: string): ParseEnvelopeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'not_json' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: 'not_object' };
  }

  const record = parsed as Record<string, unknown>;
  const type = record['type'];
  if (typeof type !== 'string' || !type.trim()) {
    return { ok: false, reason: 'missing_type' };
  }

  const eventId = record['eventId'];
  if (typeof eventId !== 'string' || !eventId.trim()) {
    return { ok: false, reason: 'missing_event_id' };
  }

  const timestamp = record['timestamp'];
  if (typeof timestamp !== 'string' || Number.isNaN(Date.parse(timestamp))) {
    return { ok: false, reason: 'invalid_timestamp' };
  }

  const payload = record['payload'];
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, reason: 'invalid_payload' };
  }

  return {
    ok: true,
    envelope: {
      type: type as PosWsMessageType,
      eventId,
      timestamp,
      payload: payload as Record<string, unknown>,
    },
  };
}

export type ParseOrderCreatedResult =
  | { ok: true; order: PosWsOrderCreatedPayload }
  | { ok: false; code: PosWsOrderErrorCode; message: string; productIds?: string[] };

/**
 * Validates an inbound `order.created` payload. Unknown/unavailable products are
 * reported so the caller can reject the whole order instead of dropping lines.
 * Product existence itself is verified in the renderer against the POS catalog.
 */
export function parseOrderCreatedPayload(
  payload: Record<string, unknown>,
): ParseOrderCreatedResult {
  const channel = payload['channel'];
  if (channel !== 'SUR_PLACE' && channel !== 'EMPORTER' && channel !== 'LIVRAISON') {
    return { ok: false, code: 'invalid_payload', message: 'Chaîne de commande invalide.' };
  }

  const rawLines = Array.isArray(payload['lines']) ? payload['lines'] : [];
  const lines: PosWsOrderLinePayload[] = [];
  for (const entry of rawLines) {
    if (!entry || typeof entry !== 'object') {
      return { ok: false, code: 'invalid_payload', message: 'Ligne de commande invalide.' };
    }
    const record = entry as Record<string, unknown>;
    const productId = typeof record['productId'] === 'string' ? record['productId'].trim() : '';
    const quantity = Number(record['quantity']);
    if (!productId) {
      return { ok: false, code: 'invalid_payload', message: 'Identifiant produit manquant.' };
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false, code: 'invalid_payload', message: 'Quantité invalide.' };
    }
    lines.push({ productId, quantity: Math.floor(quantity) });
  }

  if (lines.length === 0) {
    return { ok: false, code: 'empty_order', message: 'La commande est vide.' };
  }

  const asText = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;

  return {
    ok: true,
    order: {
      channel,
      lines,
      tableNumber: asText(payload['tableNumber']),
      customerPhone: asText(payload['customerPhone']),
      deliveryAddress: asText(payload['deliveryAddress']),
      note: asText(payload['note']),
    },
  };
}

export function hashCatalogProducts(products: PosWsProductPayload[]): string {
  const canonical = [...products]
    .map((product) => ({
      id: product.id,
      name: product.name,
      categoryId: product.categoryId,
      price: product.price,
      available: product.available !== false,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return createSimpleHash(JSON.stringify(canonical));
}

/** Small deterministic FNV-1a hash (catalog fingerprint, not a security primitive). */
function createSimpleHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
