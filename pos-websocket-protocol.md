# POS ⇄ almani-nafris.com WebSocket Protocol

Shared protocol specification for the direct, bidirectional integration between the
local restaurant POS and the website `almani-nafris.com`.

- Protocol version: **1** (`POS_WS_PROTOCOL_VERSION`)
- Transport: authenticated **WSS** (TLS), the **POS is always the client**
- Endpoint: `wss://almani-nafris.com/api/pos/ws`
- The POS initiates the outbound connection. No public POS IP, no port forwarding,
  no tunnel and no intermediary VPS is required.
- The connection is owned by the Electron **main process**, so it stays alive
  regardless of the POS screen the operator is viewing.

The POS remains the source of truth for products, prices, order numbering,
payments, kitchen printing and delivery drivers.

---

## 1. Envelope

Every message in both directions uses the same envelope:

```json
{
  "type": "event.type",
  "eventId": "uuid",
  "timestamp": "ISO-8601",
  "payload": {}
}
```

| Field       | Type   | Description                                                        |
| ----------- | ------ | ------------------------------------------------------------------ |
| `type`      | string | One of the message types in §2.                                    |
| `eventId`   | string | UUID identifying this message. Used for correlation and dedupe.    |
| `timestamp` | string | ISO-8601 UTC timestamp of creation.                                |
| `payload`   | object | Type-specific body (never `null`, never an array).                 |

An inbound envelope that is not valid JSON, is not an object, is missing
`type`/`eventId`, has an unparsable `timestamp`, or whose `payload` is not an
object is **ignored and logged** (`not_json`, `not_object`, `missing_type`,
`missing_event_id`, `invalid_timestamp`, `invalid_payload`).

Internal POS events continue to use the existing `SyncEventEnvelope`
(`OrderCreated`, `KitchenTicketPrinted`, `OrderPaid`) and are **never** reused as
transport messages. The WebSocket transport is a separate channel layered on top
of the existing sync engine.

---

## 2. Message types

| Type                | Direction | Purpose                                        |
| ------------------- | --------- | ---------------------------------------------- |
| `auth`              | POS → WS  | Authenticate the POS device.                   |
| `auth.success`      | WS → POS  | Authentication accepted.                       |
| `auth.error`        | WS → POS  | Authentication refused.                        |
| `products.sync`     | POS → WS  | Full product catalog (initial + resync).       |
| `products.updated`  | POS → WS  | Incremental catalog update.                    |
| `products.ack`      | WS → POS  | Catalog accepted/rejected.                     |
| `order.created`     | WS → POS  | New order from the website.                    |
| `order.ack`         | POS → WS  | Order durably created.                         |
| `order.error`       | POS → WS  | Order rejected (machine-readable code).        |
| `orders.sync`       | POS → WS  | Recently processed orders (reconnect recovery).|
| `ping`              | both      | Heartbeat.                                     |
| `pong`              | both      | Heartbeat reply.                               |
| `connection.status` | POS → WS  | POS connection state changes.                  |

---

## 3. Connection lifecycle and states

The POS exposes five connection states:

| State            | Meaning                                                    |
| ---------------- | ---------------------------------------------------------- |
| `DISCONNECTED`   | No open socket.                                            |
| `CONNECTING`     | Socket opening / TLS handshake in progress.                |
| `CONNECTED`      | Authenticated and idle.                                    |
| `SYNCHRONIZING`  | Authenticated, sending catalog/orders and awaiting acks.   |
| `AUTH_ERROR`     | Authentication refused — **no automatic reconnect**.       |

Flow:

1. POS opens the WSS connection.
2. On socket open, POS sends `auth`.
3. On `auth.success`, POS moves to `CONNECTED`, starts the heartbeat and runs
   resync (`SYNCHRONIZING`).
4. Resync sends `products.sync` (when the catalog changed since the last ack) and
   `orders.sync`. When `products.ack` (or the sync timeout) arrives, the POS
   returns to `CONNECTED`.
5. On `auth.error`, the POS enters `AUTH_ERROR` and closes the socket without
   retrying — the operator must fix the credentials in Settings.
6. On any other close, the POS reconnects with exponential backoff:
   `delay = min(60s, 1s × 2^attempt) × jitter(0.8 – 1.2)`.

Timeouts / intervals:

| Setting              | Value  |
| -------------------- | ------ |
| Handshake timeout    | 15 s   |
| Heartbeat interval   | 25 s   |
| Heartbeat timeout    | 10 s   |
| Resync timeout       | 8 s    |
| Order processing     | 20 s   |
| Reconnect base / max | 1 s / 60 s |
| Max frame payload    | 4 MiB  |

---

## 4. Authentication

### `auth` (POS → WS)

```json
{
  "type": "auth",
  "eventId": "uuid",
  "timestamp": "ISO-8601",
  "payload": {
    "protocolVersion": 1,
    "token": "<bearer token>",
    "tenantId": "tenant-uuid | null",
    "branchId": "branch-uuid | null",
    "deviceId": "pos-device-uuid",
    "posVersion": "0.0.0",
    "channel": "POS"
  }
}
```

| Field             | Type           | Notes                                                |
| ----------------- | -------------- | ---------------------------------------------------- |
| `protocolVersion` | number         | Currently `1`.                                       |
| `token`           | string         | Integration bearer token issued by the website.      |
| `tenantId`        | string \| null | Optional tenant scope.                               |
| `branchId`        | string \| null | Branch this POS serves.                              |
| `deviceId`        | string         | Stable POS device identifier.                        |
| `posVersion`      | string         | POS application version.                             |
| `channel`         | `"POS"`        | Constant.                                            |

If no token is configured, the POS fails immediately into `AUTH_ERROR`.

### `auth.success` (WS → POS)

```json
{
  "type": "auth.success",
  "eventId": "uuid",
  "timestamp": "ISO-8601",
  "payload": { "ok": true, "serverTime": "ISO-8601" }
}
```

### `auth.error` (WS → POS)

```json
{
  "type": "auth.error",
  "eventId": "uuid",
  "timestamp": "ISO-8601",
  "payload": { "ok": false, "reason": "invalid token", "code": "AUTH_FAILED" }
}
```

`reason` (or `message`) is surfaced in the POS status and logs.

---

## 5. Product catalog synchronization

The POS owns product UUIDs, names, prices and availability. The website keeps a
mapping from its own product IDs to the POS UUIDs. **The website never modifies
POS products.**

### Catalog payload

`products.sync`, `products.updated` and the snapshot all carry the same shape:

```json
{
  "branchId": "branch-uuid",
  "version": 7,
  "hash": "a1b2c3d4",
  "currency": "MAD",
  "categories": [{ "id": "cat-uuid", "name": "Pizzas" }],
  "products": [
    {
      "id": "pos-product-uuid",
      "name": "Pizza Margherita",
      "categoryId": "cat-uuid",
      "price": 45,
      "currency": "MAD",
      "sku": "PIZ-MARG",
      "available": true
    }
  ]
}
```

Products and categories are sorted by `id` before hashing, so the fingerprint is
deterministic.

### Versioning and hashing

- `hash` is a FNV-1a fingerprint over `{id, name, categoryId, price, available}`
  for every product (sorted by `id`).
- `version` is a monotonically increasing integer persisted locally
  (`posWsState`). It is **only bumped when the hash changes**; an unchanged
  catalog keeps the same version so a reconnect can be answered cheaply.
- `products.sync` is the **full** catalog, sent right after the first successful
  authentication and after any reconnect when the acked version differs.
- `products.updated` is sent on subsequent catalog changes (product/settings
  edits) via the existing `catalogChanged$` / `businessSettingsChanged$` streams.
  It is skipped when the version already matches the last `products.ack`.

### `products.ack` (WS → POS)

```json
{
  "type": "products.ack",
  "eventId": "uuid",
  "timestamp": "ISO-8601",
  "payload": { "version": 7, "hash": "a1b2c3d4", "ok": true }
}
```

- `ok: true` records `ackedCatalogVersion` and ends `SYNCHRONIZING`.
- `ok: false` (with optional `reason`) is logged; the catalog stays unacked and
  will be re-sent on the next connection.

---

## 6. Incoming website orders

### `order.created` (WS → POS)

```json
{
  "type": "order.created",
  "eventId": "unique-uuid",
  "timestamp": "ISO-8601",
  "payload": {
    "channel": "LIVRAISON",
    "tableNumber": "12",
    "customerPhone": "+212611223344",
    "deliveryAddress": "12 Rue Hassan II, Casablanca",
    "note": "Sonner 2x",
    "lines": [{ "productId": "pos-product-uuid", "quantity": 3 }]
  }
}
```

Supported channels: `SUR_PLACE`, `EMPORTER`, `LIVRAISON`.

Only `channel` and `lines` are required. `tableNumber` is used for `SUR_PLACE`,
`deliveryAddress` for `LIVRAISON`.

### Processing rules

1. Validate the envelope (§1) and the payload.
2. **Reject duplicate events** using the persistent `eventId` map
   (`posWsEvents`). A duplicate replays the original `order.ack` — never a
   second order.
3. Validate every `productId` against the POS catalog.
4. **Reject the whole order** if any product is unknown or unavailable — invalid
   lines are never silently dropped (see `productIds` in `order.error`).
5. Reuse the existing `PosService.createExternalOrder` order-creation path.
6. Resolve product names and unit prices locally from the catalog.
7. Calculate totals internally.
8. Use the existing ticket numbering (`T01-001`, `W00001`, `E00001`, …).
9. Persist with the existing `CompletedOrder` structure.
10. Trigger the existing kitchen printing (see §8).
11. Send `order.ack` after **durable** creation.
12. Printing failures are handled separately and never reject or duplicate an
    order.

### `order.ack` (POS → WS)

Sent after the order is durably stored. `eventId` echoes the **original**
`order.created` event id.

```json
{
  "type": "order.ack",
  "eventId": "original-event-uuid",
  "timestamp": "ISO-8601",
  "payload": {
    "ok": true,
    "orderId": "pos-order-uuid",
    "orderNumber": "W00001",
    "total": 135
  }
}
```

### `order.error` (POS → WS)

```json
{
  "type": "order.error",
  "eventId": "original-event-uuid",
  "timestamp": "ISO-8601",
  "payload": {
    "ok": false,
    "code": "unknown_product",
    "message": "Produit inconnu: 3f2c…",
    "productIds": ["3f2c…"]
  }
}
```

`eventId` always echoes the original `order.created` event id (acknowledgment
correlation). `productIds` lists the offending products for
`unknown_product` / `product_unavailable`.

### Error codes

| Code                  | Meaning                                                       |
| --------------------- | ------------------------------------------------------------- |
| `invalid_payload`     | Malformed envelope/payload or invalid line/quantity.          |
| `empty_order`         | No usable lines.                                              |
| `unknown_product`     | At least one `productId` is not in the POS catalog.           |
| `product_unavailable` | At least one product is marked unavailable.                   |
| `session_unavailable` | No open POS session (operator not logged in).                 |
| `pos_unavailable`     | POS renderer not reachable (window closed/loading).           |
| `processing_timeout`  | Order processing exceeded the 20 s budget.                    |
| `internal_error`      | Unexpected failure while creating the order.                  |

---

## 7. Reset, recovery and dedupe

### `orders.sync` (POS → WS)

Sent on every reconnect (resync) so the website can recover orders it may have
missed while the POS was offline.

```json
{
  "type": "orders.sync",
  "eventId": "uuid",
  "timestamp": "ISO-8601",
  "payload": {
    "branchId": "branch-uuid",
    "orders": [
      {
        "eventId": "original-event-uuid",
        "orderId": "pos-order-uuid",
        "orderNumber": "W00001",
        "total": 135,
        "channel": "LIVRAISON",
        "createdAt": "ISO-8601"
      }
    ]
  }
}
```

### Durable deduplication

- Every processed external `eventId` is persisted in the `posWsEvents` store
  (`eventId → orderId, orderNumber, total, channel, source, processedAt`)
  **within the same Dexie transaction** that writes the order and its sync
  events. A retry therefore can never create a second order.
- In-flight retries for the same `eventId` are serialized in memory, so a
  duplicate arriving mid-processing reuses the first result.

---

## 8. Printing and delivery drivers

- Kitchen printing reuses the existing POS printing pipeline. It is triggered
  after the order is stored and is fully decoupled: a printer failure is logged
  (and visible in Settings) but never rejects or duplicates the order.
- **The website must never assign or send `livreurId`.** Any externally supplied
  driver id is ignored. For `LIVRAISON` orders the POS assigns the driver from
  its own driver-management system (existing rules / manual selection) and stores
  it in `CompletedOrder.livreurId`. When no driver is available the order is left
  unassigned.

---

## 9. Heartbeat and status

- **`ping`** is sent by both sides; the receiver answers with **`pong`**.
  The POS sends `ping` every 25 s and closes the socket (reconnect) if no
  `pong`/traffic arrives within 10 s.
- The POS emits **`connection.status`** whenever its state changes:

```json
{
  "type": "connection.status",
  "eventId": "uuid",
  "timestamp": "ISO-8601",
  "payload": { "state": "CONNECTED", "at": "ISO-8601", "catalogVersion": 7 }
}
```

---

## 10. Credentials and configuration

- The integration endpoint, branch/device ids and bearer token are configured
  from **Settings → Site almani-nafris.com**.
- The token is encrypted at rest with Electron `safeStorage` and stored in
  `pos-integration.json` in the app's user-data directory (file mode `0600`).
  When OS encryption is unavailable it falls back to plaintext storage.

---

## 11. Settings / status surface

The Settings panel shows: enable/disable toggle, endpoint URL and device id,
token entry, manual connect/disconnect, the live connection-state badge
(`Connected` / `Connecting` / `Disconnected` / `Authentication Error` /
`Synchronizing`), catalog version/hash, acked version, reconnect attempts,
pending orders, connection time and the integration log.
