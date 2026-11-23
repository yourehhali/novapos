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

**Direction legend:** `POS →` means the POS sends the message (server receives it),
`→ POS` means the POS expects/receives it (server sends it).

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

| Field       | Type   | Required | Description                                                       |
| ----------- | ------ | -------- | ----------------------------------------------------------------- |
| `type`      | string | yes      | One of the message types in §2.                                   |
| `eventId`   | string | yes      | UUID identifying this message. Used for correlation and dedupe.   |
| `timestamp` | string | yes      | ISO-8601 UTC timestamp of creation (must be parseable by `Date.parse`). |
| `payload`   | object | yes      | Type-specific body. Must be a plain object — never `null`, never an array. |

An inbound envelope that is not valid JSON, is not an object, is missing
`type`/`eventId`, has an unparsable `timestamp`, or whose `payload` is not an
object is **ignored and logged** with one of these reasons:
`not_json`, `not_object`, `missing_type`, `missing_event_id`, `invalid_timestamp`,
`invalid_payload`. The POS never crashes or disconnects on malformed traffic.

An inbound envelope whose `type` is not handled is logged as
`Type de message non pris en charge: <type>` and otherwise ignored.

Internal POS events continue to use the existing `SyncEventEnvelope`
(`OrderCreated`, `KitchenTicketPrinted`, `OrderPaid`) and are **never** reused as
transport messages. The WebSocket transport is a separate channel layered on top
of the existing sync engine.

---

## 2. Message index

| Type                | Direction | Purpose                                          |
| ------------------- | --------- | ------------------------------------------------ |
| `auth`              | POS →     | Authenticate the POS device.                     |
| `auth.success`      | → POS     | Authentication accepted.                         |
| `auth.error`        | → POS     | Authentication refused.                          |
| `products.sync`     | POS →     | Full product catalog (initial + reconnect resync).|
| `products.updated`  | POS →     | Incremental catalog update.                      |
| `products.ack`      | → POS     | Catalog accepted/rejected.                       |
| `order.created`     | → POS     | New order from the website.                      |
| `order.ack`         | POS →     | Order durably created.                           |
| `order.error`       | POS →     | Order rejected (machine-readable code).          |
| `orders.sync`       | POS →     | Recently processed orders (reconnect recovery).  |
| `ping`              | both      | Heartbeat.                                       |
| `pong`              | both      | Heartbeat reply.                                 |
| `connection.status` | both      | Connection state changes (POS emits; may also receive). |

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

1. POS opens the WSS connection → state `CONNECTING`.
2. On socket open, POS sends `auth`.
3. On `auth.success`, POS → `CONNECTED`, starts the heartbeat and runs resync
   (`SYNCHRONIZING`).
4. Resync sends `products.sync` (when the catalog version differs from the last
   acked version) and `orders.sync` (only when there is at least one processed
   order). On `products.ack` — or after the 8 s resync timeout — POS returns to
   `CONNECTED`.
5. On `auth.error`, POS enters `AUTH_ERROR` and closes the socket **without
   retrying** — the operator must fix the credentials in Settings.
6. On any other close, POS reconnects with exponential backoff:
   `delay = min(60s, 1s × 2^attempt) × jitter(0.8 – 1.2)`.

If no token is configured the POS fails immediately into `AUTH_ERROR` without
opening a socket.

Timeouts / intervals:

| Setting              | Value        |
| -------------------- | ------------ |
| Handshake timeout    | 15 s         |
| Heartbeat interval   | 25 s         |
| Heartbeat timeout    | 10 s         |
| Resync timeout       | 8 s          |
| Order processing     | 20 s         |
| Reconnect base / max | 1 s / 60 s   |
| Max frame payload    | 4 MiB        |

---

## 4. Messages sent by the POS (`POS → server`)

### 4.1 `auth`

Sent immediately after the socket opens.

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

| Field             | Type           | Required | Notes                                            |
| ----------------- | -------------- | -------- | ------------------------------------------------ |
| `protocolVersion` | number         | yes      | Currently `1`.                                   |
| `token`           | string         | yes      | Integration bearer token issued by the website.  |
| `tenantId`        | string \| null | yes      | Tenant scope (may be `null`).                    |
| `branchId`        | string \| null | yes      | Branch this POS serves (may be `null`).          |
| `deviceId`        | string         | yes      | Stable POS device identifier (`unknown-device` if unset). |
| `posVersion`      | string         | yes      | POS application version.                         |
| `channel`         | `"POS"`        | yes      | Constant.                                        |

### 4.2 `products.sync`

Full catalog. Sent right after the first successful authentication and after any
reconnect when the acked version differs from the current version.

```json
{
  "type": "products.sync",
  "eventId": "uuid",
  "timestamp": "ISO-8601",
  "payload": {
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
}
```

### 4.3 `products.updated`

Incremental catalog update. Same payload shape as `products.sync`. Sent on
subsequent catalog changes (product/settings edits) and skipped when the version
already matches the last `products.ack`.

```json
{
  "type": "products.updated",
  "eventId": "uuid",
  "timestamp": "ISO-8601",
  "payload": { "branchId": "branch-uuid", "version": 8, "hash": "b2c3d4e5", "currency": "MAD", "categories": [], "products": [] }
}
```

Catalog payload fields:

| Field        | Type     | Required | Notes                                                       |
| ------------ | -------- | -------- | ----------------------------------------------------------- |
| `branchId`   | string   | yes      | Branch id (`""` when no branch session).                    |
| `version`    | number   | yes      | Monotonic catalog version (see §8).                         |
| `hash`       | string   | yes      | FNV-1a fingerprint of the product list (see §8).            |
| `currency`   | string   | yes      | Currency code (e.g. `MAD`).                                 |
| `categories` | array    | yes      | `{ id, name }`, sorted by `id`.                             |
| `products`   | array    | yes      | `{ id, name, categoryId, price, currency, sku, available }`, sorted by `id`. |

### 4.4 `order.ack`

Sent after a website order is **durably stored**. `eventId` echoes the original
`order.created` event id (correlation).

```json
{
  "type": "order.ack",
  "eventId": "original-order-created-event-uuid",
  "timestamp": "ISO-8601",
  "payload": {
    "ok": true,
    "orderId": "pos-order-uuid",
    "orderNumber": "W00001",
    "total": 135
  }
}
```

| Field         | Type    | Notes                                              |
| ------------- | ------- | -------------------------------------------------- |
| `ok`          | `true`  | Always `true` for an ack.                          |
| `orderId`     | string  | POS order UUID.                                    |
| `orderNumber` | string  | POS ticket number (`T01-001`, `W00001`, `E00001`, …). |
| `total`       | number  | Gross total actually stored on the order.          |

### 4.5 `order.error`

Sent when an inbound order is rejected. `eventId` echoes the original
`order.created` event id.

```json
{
  "type": "order.error",
  "eventId": "original-order-created-event-uuid",
  "timestamp": "ISO-8601",
  "payload": {
    "ok": false,
    "code": "unknown_product",
    "message": "Produit inconnu: 3f2c…",
    "productIds": ["3f2c…"]
  }
}
```

| Field        | Type     | Required | Notes                                                        |
| ------------ | -------- | -------- | ------------------------------------------------------------ |
| `ok`         | `false`  | yes      | Always `false` for an error.                                 |
| `code`       | string   | yes      | One of the codes in §9.                                      |
| `message`    | string   | yes      | Human-readable (French) explanation.                         |
| `productIds` | string[] | no       | Offending product ids for `unknown_product` / `product_unavailable`. |

### 4.6 `orders.sync`

Sent during reconnect resync **only when the POS has processed at least one
website order**. The list is the newest 200 entries ordered by processing time.
The website uses it to recover orders it may have missed while the POS was
offline.

```json
{
  "type": "orders.sync",
  "eventId": "uuid",
  "timestamp": "ISO-8601",
  "payload": {
    "branchId": "branch-uuid",
    "orders": [
      {
        "eventId": "original-order-created-event-uuid",
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

### 4.7 `ping`

The POS sends `ping` every 25 s while connected. It closes the socket (and
reconnects) if no `pong`/traffic arrives within 10 s.

```json
{
  "type": "ping",
  "eventId": "uuid",
  "timestamp": "ISO-8601",
  "payload": { "at": "ISO-8601" }
}
```

### 4.8 `pong`

Sent only in reply to a server `ping`. The payload echoes the ping's `eventId`.

```json
{
  "type": "pong",
  "eventId": "uuid",
  "timestamp": "ISO-8601",
  "payload": { "echo": "<ping eventId>" }
}
```

### 4.9 `connection.status`

Emitted by the POS on every state change (while the socket is open).

```json
{
  "type": "connection.status",
  "eventId": "uuid",
  "timestamp": "ISO-8601",
  "payload": {
    "state": "CONNECTED",
    "at": "ISO-8601",
    "catalogVersion": 7
  }
}
```

| Field            | Type   | Required | Notes                                     |
| ---------------- | ------ | -------- | ----------------------------------------- |
| `state`          | string | yes      | `DISCONNECTED` / `CONNECTING` / `CONNECTED` / `SYNCHRONIZING` / `AUTH_ERROR`. |
| `at`             | string | yes      | ISO-8601 timestamp of the change.         |
| `catalogVersion` | number | no       | Current catalog version, when known.      |

---

## 5. Messages the POS expects (`server → POS`)

### 5.1 `auth.success`

```json
{
  "type": "auth.success",
  "eventId": "uuid",
  "timestamp": "ISO-8601",
  "payload": { "ok": true, "serverTime": "ISO-8601" }
}
```

| Field        | Type    | Required | Notes                       |
| ------------ | ------- | -------- | --------------------------- |
| `ok`         | boolean | yes      | Must be `true`.             |
| `serverTime` | string  | no       | ISO-8601 server clock.      |

### 5.2 `auth.error`

```json
{
  "type": "auth.error",
  "eventId": "uuid",
  "timestamp": "ISO-8601",
  "payload": { "ok": false, "reason": "invalid token", "code": "AUTH_FAILED" }
}
```

| Field    | Type    | Required | Notes                                                   |
| -------- | ------- | -------- | ------------------------------------------------------- |
| `ok`     | boolean | yes      | Must be `false`.                                        |
| `reason` | string  | no       | Shown in the POS status/logs. Falls back to `message`.  |
| `code`   | string  | no       | Machine-readable reason (e.g. `AUTH_FAILED`).           |

The POS accepts either `reason` or `message`. After `auth.error` the POS closes
the socket and does **not** reconnect automatically.

### 5.3 `products.ack`

```json
{
  "type": "products.ack",
  "eventId": "uuid",
  "timestamp": "ISO-8601",
  "payload": { "version": 7, "hash": "a1b2c3d4", "ok": true }
}
```

| Field     | Type    | Required | Notes                                                  |
| --------- | ------- | -------- | ------------------------------------------------------ |
| `version` | number  | no       | Acked version. Defaults to the POS's current version.  |
| `hash`    | string  | no       | Acked fingerprint (informational).                     |
| `ok`      | boolean | yes      | `true` records `ackedCatalogVersion` and ends `SYNCHRONIZING`. `false` (with optional `reason`) is logged and the catalog is re-sent on the next connection. |

### 5.4 `order.created`

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
    "lines": [
      { "productId": "pos-product-uuid", "quantity": 3 }
    ]
  }
}
```

| Field             | Type    | Required | Notes                                                              |
| ----------------- | ------- | -------- | ------------------------------------------------------------------ |
| `channel`         | string  | yes      | `SUR_PLACE` \| `EMPORTER` \| `LIVRAISON`.                          |
| `tableNumber`     | string  | no       | Used for `SUR_PLACE` only (ignored otherwise).                     |
| `customerPhone`   | string  | no       | Free text.                                                          |
| `deliveryAddress` | string  | no       | Used for `LIVRAISON` only (ignored otherwise).                     |
| `note`            | string  | no       | Free text.                                                          |
| `lines`           | array   | yes      | At least one line: `{ productId: string, quantity: number > 0 }`.   |

Validation applied by the POS:

- `channel` must be one of the three values → otherwise `invalid_payload`.
- Each line must have a non-empty `productId` and a finite `quantity > 0`
  (fractional quantities are floored) → otherwise `invalid_payload`.
- At least one valid line → otherwise `empty_order`.
- Every `productId` must exist in the POS catalog → otherwise `unknown_product`.
- No line may reference an unavailable product → otherwise `product_unavailable`.
- The whole order is rejected if any of the above fails; invalid lines are
  **never** silently dropped.

### 5.5 `ping`

The website may send `ping` at any time. The POS answers with a `pong` carrying
`{ "echo": "<ping eventId>" }` and treats it as liveness traffic.

```json
{
  "type": "ping",
  "eventId": "uuid",
  "timestamp": "ISO-8601",
  "payload": { "at": "ISO-8601" }
}
```

### 5.6 `pong`

The website must answer every POS `ping` with `pong` (any payload). The POS only
requires the traffic; any received `pong` clears the heartbeat deadline.

```json
{
  "type": "pong",
  "eventId": "uuid",
  "timestamp": "ISO-8601",
  "payload": {}
}
```

### 5.7 `connection.status` (optional, informational)

If the website sends its own `connection.status`, the POS logs
`Statut serveur: <state>` and takes no other action.

---

## 6. Order processing rules

1. Validate the envelope (§1) and the payload.
2. **Reject duplicate events** using the persistent `eventId` map (`posWsEvents`).
   A duplicate replays the original `order.ack` — never a second order.
3. Validate every `productId` against the POS catalog.
4. **Reject the whole order** if any product is unknown or unavailable — invalid
   lines are never silently dropped (see `productIds` in `order.error`).
5. Refuse the order with `session_unavailable` when no POS session is open, and
   with `day_closed` when the current business day has been closed (see §10).
6. Reuse the existing `PosService.createExternalOrder` order-creation path.
7. Resolve product names and unit prices locally from the catalog.
8. Calculate totals internally (VAT is extracted from the VAT-inclusive price —
   see §7).
9. Use the existing ticket numbering (`T01-001`, `W00001`, `E00001`, …).
10. Persist with the existing `CompletedOrder` structure.
11. Trigger the existing kitchen printing (see §9).
12. Send `order.ack` after **durable** creation.
13. Printing failures are handled separately and never reject or duplicate an
    order.

---

## 7. Amounts and VAT

Catalog prices are **VAT-inclusive**. On order creation the POS extracts the VAT
out of the gross total (`net + vat === total`):

| Channel     | VAT rate |
| ----------- | -------- |
| `SUR_PLACE` | 20 %     |
| `EMPORTER`  | 20 %     |
| `LIVRAISON` | 20 %     |

`total` sent in `order.ack` and `orders.sync` is always the gross (VAT-inclusive)
amount actually stored on the order.

---

## 8. Catalog versioning and hashing

- `hash` is a FNV-1a fingerprint over `{id, name, categoryId, price, available}`
  for every product (sorted by `id`), so it is deterministic.
- `version` is a monotonically increasing integer persisted locally
  (`posWsState`). It is **only bumped when the hash changes**; an unchanged
  catalog keeps the same version so a reconnect can be answered cheaply.
- `products.sync` is the **full** catalog, sent right after the first successful
  authentication and after any reconnect when the acked version differs.
- `products.updated` is sent on subsequent catalog changes (product/settings
  edits) via the `catalogChanged$` / `businessSettingsChanged$` streams, and is
  skipped when the version already matches the last `products.ack`.

---

## 9. Printing and delivery drivers

- Kitchen printing reuses the existing POS printing pipeline. It is triggered
  after the order is stored and is fully decoupled: a printer failure is logged
  (and visible in Settings) but never rejects or duplicates the order.
- **The website must never assign or send `livreurId`.** Any externally supplied
  driver id is ignored. For `LIVRAISON` orders the POS assigns the driver from
  its own driver-management system (existing rules / manual selection) and stores
  it in `CompletedOrder.livreurId`. When no driver is available the order is left
  unassigned.

---

## 10. Day session, dedupe, recovery and heartbeat

### Day session lock

The POS tracks a per-branch business day (`DaySession`, `startedAt`/`closedAt`).
When the operator closes the day, all order creation is refused:

- external (website) orders → `order.error` with code `day_closed`;
- the daily report is printed and the dashboard is reset.

A new day must be started on the POS before website orders are accepted again.

### Durable deduplication

- Every processed external `eventId` is persisted in the `posWsEvents` store
  (`eventId → orderId, orderNumber, total, channel, source, processedAt`)
  **within the same Dexie transaction** that writes the order and its sync
  events. A retry therefore can never create a second order.
- In-flight retries for the same `eventId` are serialized in memory, so a
  duplicate arriving mid-processing reuses the first result.

### Error codes (`order.error`)

| Code                  | Meaning                                                       |
| --------------------- | ------------------------------------------------------------- |
| `invalid_payload`     | Malformed envelope/payload or invalid line/quantity.          |
| `empty_order`         | No usable lines.                                              |
| `unknown_product`     | At least one `productId` is not in the POS catalog.           |
| `product_unavailable` | At least one product is marked unavailable.                   |
| `session_unavailable` | No open POS session (operator not logged in).                 |
| `day_closed`          | The current business day has been closed on the POS.          |
| `pos_unavailable`     | POS renderer not reachable (window closed/loading).           |
| `processing_timeout`  | Order processing exceeded the 20 s budget.                    |
| `internal_error`      | Unexpected failure while creating the order.                  |

### Heartbeat

- `ping` is sent by both sides; the receiver answers with `pong`.
- The POS sends `ping` every 25 s and closes the socket (to reconnect) if no
  `pong`/traffic arrives within 10 s.
- A server `ping` is answered immediately with a POS `pong` (`{ echo }`).

---

## 11. Credentials and configuration

- The integration endpoint, branch/device ids and bearer token are configured
  from **Settings → Site almani-nafris.com**.
- The token is encrypted at rest with Electron `safeStorage` and stored in
  `pos-integration.json` in the app's user-data directory (file mode `0600`).
  When OS encryption is unavailable it falls back to plaintext storage.
- The POS auto-computes the catalog `version` and `hash` and tracks the acked
  version; the website only needs to acknowledge. The **device id and integration
  token must be issued by the website** and entered by the operator.

---

## 12. Settings / status surface

The Settings panel shows: enable/disable toggle, endpoint URL and device id,
token entry, manual connect/disconnect, the live connection-state badge
(`Connected` / `Connecting` / `Disconnected` / `Authentication Error` /
`Synchronizing`), catalog version/hash, acked version, reconnect attempts,
pending orders, connection time and the integration log.

---

## 13. Quick reference (cheat sheet)

### Server must implement (receives from POS, sends to POS)

| POS sends        | Payload keys                                                        |
| ---------------- | ------------------------------------------------------------------- |
| `auth`           | `protocolVersion, token, tenantId, branchId, deviceId, posVersion, channel` |
| `products.sync`  | `branchId, version, hash, currency, categories[], products[]`        |
| `products.updated` | same as `products.sync`                                            |
| `order.ack`      | `ok:true, orderId, orderNumber, total` (echoes `order.created` id)   |
| `order.error`    | `ok:false, code, message, productIds?` (echoes `order.created` id)   |
| `orders.sync`    | `branchId, orders[]: {eventId, orderId, orderNumber, total, channel, createdAt}` |
| `ping`           | `at`                                                                 |
| `pong`           | `echo` (only in reply to server `ping`)                              |
| `connection.status` | `state, at, catalogVersion?`                                      |

| POS expects (server sends) | Payload keys                                            |
| -------------------------- | ------------------------------------------------------- |
| `auth.success`             | `ok:true, serverTime?`                                  |
| `auth.error`               | `ok:false, reason?, code?`                              |
| `products.ack`             | `version?, hash?, ok, reason?`                          |
| `order.created`            | `channel, tableNumber?, customerPhone?, deliveryAddress?, note?, lines[]` |
| `ping`                     | `at`                                                    |
| `pong`                     | `{}` (any payload)                                      |

### Minimal happy-path sequence

```text
POS →  auth
    →  POS  auth.success
POS →  products.sync
    →  POS  products.ack
POS →  orders.sync            (only if orders were processed before)
POS →  connection.status ...  (on every state change)
POS →  ping  ...              (every 25 s)
    →  POS  pong

--- later, website order ---
    →  POS  order.created
POS →  order.ack   (or order.error)
```