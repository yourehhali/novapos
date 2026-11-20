// @vitest-environment node
//
// Contract tests for the shared POS ⇄ almani-nafris.com WebSocket protocol
// (electron/ws-protocol.ts). These guard the message envelope, the inbound
// `order.created` validation rules and the catalog fingerprint used for
// versioning. See pos-websocket-protocol.md for the full specification.
import { describe, expect, it } from 'vitest';
import {
  buildEnvelope,
  encodeEnvelope,
  hashCatalogProducts,
  parseEnvelope,
  parseOrderCreatedPayload,
  type PosWsProductPayload,
} from '../../../../electron/ws-protocol';

const catalogProduct = (overrides: Partial<PosWsProductPayload> = {}): PosWsProductPayload => ({
  id: 'p1',
  name: 'Pizza Margherita',
  categoryId: 'c1',
  price: 45,
  currency: 'MAD',
  sku: 'PIZ-MARG',
  available: true,
  ...overrides,
});

describe('ws-protocol envelope', () => {
  it('builds and encodes a valid shared envelope', () => {
    const envelope = buildEnvelope('ping', { at: 'now' });
    expect(envelope.type).toBe('ping');
    expect(envelope.payload).toEqual({ at: 'now' });
    expect(envelope.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isNaN(Date.parse(envelope.timestamp))).toBe(false);
    expect(JSON.parse(encodeEnvelope(envelope))).toEqual(envelope);
  });

  it('parses a well-formed envelope', () => {
    const parsed = parseEnvelope(
      JSON.stringify({
        type: 'order.created',
        eventId: 'e1',
        timestamp: new Date().toISOString(),
        payload: { a: 1 },
      }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.envelope.type).toBe('order.created');
      expect(parsed.envelope.payload).toEqual({ a: 1 });
    }
  });

  it.each([
    ['not json', 'not_json'],
    ['null', 'not_object'],
    ['"text"', 'not_object'],
    [JSON.stringify({ eventId: 'e', timestamp: new Date().toISOString(), payload: {} }), 'missing_type'],
    [JSON.stringify({ type: 'x', timestamp: new Date().toISOString(), payload: {} }), 'missing_event_id'],
    [JSON.stringify({ type: 'x', eventId: 'e', timestamp: 'not-a-date', payload: {} }), 'invalid_timestamp'],
    [JSON.stringify({ type: 'x', eventId: 'e', timestamp: new Date().toISOString(), payload: [] }), 'invalid_payload'],
  ])('rejects malformed traffic (%s)', (raw, reason) => {
    const parsed = parseEnvelope(raw);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.reason).toBe(reason);
    }
  });
});

describe('parseOrderCreatedPayload', () => {
  const base = {
    channel: 'LIVRAISON',
    lines: [{ productId: 'p1', quantity: 3 }],
  };

  it('accepts a valid delivery order and trims text fields', () => {
    const result = parseOrderCreatedPayload({
      ...base,
      customerPhone: ' +212611223344 ',
      deliveryAddress: '12 Rue Hassan II',
      note: 'Sonner 2x',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order.channel).toBe('LIVRAISON');
      expect(result.order.customerPhone).toBe('+212611223344');
      expect(result.order.lines).toEqual([{ productId: 'p1', quantity: 3 }]);
    }
  });

  it('rejects an unsupported channel', () => {
    const result = parseOrderCreatedPayload({ ...base, channel: 'DRIVE' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_payload');
    }
  });

  it('rejects a line without a product id', () => {
    const result = parseOrderCreatedPayload({ ...base, lines: [{ quantity: 1 }] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_payload');
    }
  });

  it('rejects a non-positive quantity', () => {
    const result = parseOrderCreatedPayload({ ...base, lines: [{ productId: 'p1', quantity: 0 }] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_payload');
    }
  });

  it('rejects an empty order', () => {
    const result = parseOrderCreatedPayload({ ...base, lines: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('empty_order');
    }
  });
});

describe('hashCatalogProducts', () => {
  it('is deterministic and independent of product order', () => {
    const a = hashCatalogProducts([catalogProduct({ id: 'p1' }), catalogProduct({ id: 'p2' })]);
    const b = hashCatalogProducts([catalogProduct({ id: 'p2' }), catalogProduct({ id: 'p1' })]);
    expect(a).toBe(b);
  });

  it('changes when a price changes', () => {
    const before = hashCatalogProducts([catalogProduct({ price: 45 })]);
    const after = hashCatalogProducts([catalogProduct({ price: 50 })]);
    expect(before).not.toBe(after);
  });

  it('changes when availability changes', () => {
    const before = hashCatalogProducts([catalogProduct({ available: true })]);
    const after = hashCatalogProducts([catalogProduct({ available: false })]);
    expect(before).not.toBe(after);
  });

  it('ignores sell-side metadata such as sku and currency', () => {
    const base = hashCatalogProducts([catalogProduct({ sku: 'A', currency: 'MAD' })]);
    const changed = hashCatalogProducts([catalogProduct({ sku: 'B', currency: 'EUR' })]);
    expect(base).toBe(changed);
  });
});
