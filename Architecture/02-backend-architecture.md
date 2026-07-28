# 02. Backend Architecture

## Backend Style

The backend is a modular monolith implemented with Java 21 and Spring Boot 3. Each module owns its domain model, application services, persistence adapters, and internal events. Modules communicate through explicit interfaces and domain events inside one deployable application.

## Module Responsibilities

| Module | Responsibilities | Why It Exists |
|---|---|---|
| `platform.identity` | Authentication, JWT issuance, refresh token rotation, password policy, session revocation | Centralizes security-critical logic. |
| `platform.authorization` | Roles, permissions, policy evaluation, route/resource access checks | Separates identity proof from permission decisions. |
| `platform.tenant` | Businesses, branches, business settings, device registration | Enforces SaaS isolation and operational scoping. |
| `sales.pos` | Orders, order lines, discounts, taxes, cashier sessions, sales lifecycle | Core transactional POS workflow. |
| `hospitality.tables` | Dining areas, tables, seat movement, merge/split support | Required for restaurant and cafe operations. |
| `hospitality.kitchen` | Ticket generation, kitchen queues, preparation states, display synchronization | Decouples prep flow from cashier flow. |
| `catalog.products` | Products, categories, variants, modifiers, barcode lookup, pricing rules | Single source of saleable item definitions. |
| `inventory.stock` | Stock ledgers, counts, waste, adjustments, transfers, thresholds | Keeps inventory behavior consistent and auditable. |
| `procurement.purchasing` | Suppliers, purchase orders, receiving, cost updates | Supports replenishment and supply chain control. |
| `crm.customers` | Customer profiles, loyalty-ready profile base, sales association | Needed for invoices, reporting, and customer service. |
| `finance.payments` | Payment capture, split tenders, refunds, settlement states | Keeps money flow explicit and controlled. |
| `finance.invoicing` | Invoice issuance, numbering, compliance-ready invoice records | Separates tax document generation from order flow. |
| `finance.expenses` | Expenses, categories, approvals, branch cost tracking | Covers store-level expense management. |
| `analytics.reports` | Aggregates, branch KPIs, reconciliations, snapshot reports | Avoids polluting transactional modules with report concerns. |
| `platform.notifications` | In-app notifications, operational alerts, optional email/SMS adapters | Central point for operator-facing messaging. |
| `platform.audit` | Security audit logs, business audit logs, trace links to events | Required for accountability and investigations. |
| `platform.sync` | Event ingestion, replay, dedupe, cursoring, replay status, recovery | Backbone of offline-first consistency. |
| `platform.printing` | Receipt templates, kitchen print jobs, printer routing metadata | Encapsulates print concerns and branch device mapping. |
| `platform.realtime` | WebSocket session channels, topic fanout, branch presence | Supports live kitchen and manager dashboards. |
| `platform.jobs` | Background workers, retry handlers, cleanup, projection rebuilds | Keeps heavy and asynchronous work off request threads. |

## Package Diagram

```mermaid
classDiagram
    class platform_identity
    class platform_authorization
    class platform_tenant
    class sales_pos
    class hospitality_tables
    class hospitality_kitchen
    class catalog_products
    class inventory_stock
    class procurement_purchasing
    class crm_customers
    class finance_payments
    class finance_invoicing
    class finance_expenses
    class analytics_reports
    class platform_notifications
    class platform_audit
    class platform_sync
    class platform_printing
    class platform_realtime
    class platform_jobs

    sales_pos --> platform_authorization : authorize commands
    sales_pos --> platform_tenant : tenant/branch scope
    sales_pos --> catalog_products : resolve products and prices
    sales_pos --> finance_payments : create payment intents
    sales_pos --> finance_invoicing : issue invoice after payment
    sales_pos --> inventory_stock : emit stock consumption events
    sales_pos --> platform_printing : request receipt/kitchen print jobs
    sales_pos --> platform_sync : persist immutable events
    hospitality_tables --> sales_pos : attach orders to service locations
    hospitality_kitchen --> sales_pos : consume order preparation events
    hospitality_kitchen --> platform_realtime : push kitchen updates
    procurement_purchasing --> inventory_stock : receiving updates stock ledger
    finance_payments --> platform_audit : audit financial operations
    platform_identity --> platform_authorization : principal permissions
    platform_sync --> platform_jobs : replay and retry tasks
    analytics_reports --> platform_sync : rebuild projections from events
```

## Component Diagram

```mermaid
flowchart TD
    Controller["REST / WebSocket Entry Points"] --> AppServices["Application Services"]
    AppServices --> Policy["Authorization Policy Engine"]
    AppServices --> Domain["Domain Aggregates and Rules"]
    AppServices --> EventStore["Event Store Writer"]
    AppServices --> Repositories["Module-Owned Repositories"]
    EventStore --> Postgres["PostgreSQL"]
    Repositories --> Postgres
    EventStore --> Outbox["Sync Outbox / Replay Metadata"]
    Outbox --> Workers["Background Workers"]
    Workers --> ProjectionUpdater["Projection Updater"]
    Workers --> NotificationDispatcher["Notification Dispatcher"]
    Workers --> WebSocketHub["WebSocket Gateway"]
    Workers --> PrinterDispatcher["Print Job Dispatcher"]
    WebSocketHub --> Redis["Redis Pub/Sub and transient coordination"]
```

## Communication Diagram

```mermaid
graph LR
    Client["Angular PWA"] --> AuthAPI["Identity API"]
    Client --> POSAPI["POS Command API"]
    Client --> SyncAPI["Synchronization API"]
    Client --> WS["WebSocket Endpoint"]
    POSAPI --> Sales["sales.pos"]
    POSAPI --> Tables["hospitality.tables"]
    POSAPI --> Payments["finance.payments"]
    POSAPI --> Printing["platform.printing"]
    Sales --> Sync["platform.sync"]
    Payments --> Sync
    Tables --> Sync
    Sync --> Workers["platform.jobs"]
    Workers --> Reports["analytics.reports"]
    Workers --> Audit["platform.audit"]
    Workers --> WS
    Workers --> Redis
    Sales --> PG["PostgreSQL"]
    Sync --> PG
    Reports --> PG
```

## Dependency Diagram With Rationale

```mermaid
graph TD
    Identity["Identity"] --> Authorization["Authorization: evaluate subject privileges"]
    Authorization --> Tenant["Tenant: scope subject to business and branch"]
    POS["POS"] --> Catalog["Catalog: resolve products, taxes, prices, modifiers"]
    POS --> Payments["Payments: capture and refund tenders"]
    POS --> Inventory["Inventory: apply stock consumption after confirmed sellable actions"]
    POS --> Printing["Printing: produce customer and kitchen outputs"]
    POS --> Sync["Sync: write immutable events for replay"]
    Tables["Tables"] --> POS["POS: service location binds active order"]
    Kitchen["Kitchen"] --> POS["POS: preparation states derive from ordered items"]
    Purchasing["Purchasing"] --> Inventory["Inventory: receiving creates stock-in ledger entries"]
    Invoicing["Invoicing"] --> Customers["Customers: invoice party and tax identity"]
    Reports["Reports"] --> Sync["Sync: projections rebuild from authoritative event stream"]
    Audit["Audit"] --> Sync["Sync: correlation ids and immutable event references"]
```

## Internal Layering Per Module

```mermaid
graph TD
    API["Inbound Adapter: REST / WS / Scheduler"] --> Application["Application Layer"]
    Application --> Domain["Domain Layer"]
    Application --> Ports["Ports / Interfaces"]
    Ports --> Persistence["Persistence Adapters"]
    Ports --> External["Infrastructure Adapters"]
    Domain --> DomainEvents["Internal Domain Events"]
    DomainEvents --> Application
```

## Request Lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant UI as Angular PWA
    participant Filter as Security Filter Chain
    participant Ctrl as POS Controller
    participant Authz as Authorization Service
    participant App as POS Application Service
    participant Domain as Order Aggregate
    participant Sync as Sync Event Writer
    participant DB as PostgreSQL
    participant WS as WebSocket Gateway

    UI->>Filter: POST /api/pos/orders/{id}/payments
    Filter->>Filter: Validate JWT / branch scope
    Filter->>Ctrl: Authenticated request
    Ctrl->>Authz: Check permission PAYMENT_CREATE
    Authz-->>Ctrl: Allowed
    Ctrl->>App: Execute command
    App->>Domain: Apply business rules
    Domain-->>App: PaymentReceived event
    App->>Sync: Persist event envelope + dedupe metadata
    Sync->>DB: Transactionally store event and projection updates
    DB-->>Sync: Commit success
    Sync-->>App: Event sequence assigned
    App-->>Ctrl: Updated order projection
    Ctrl-->>UI: 200 OK
    Sync->>WS: Publish branch update
    WS-->>UI: Order/payment updated
```

## Synchronization Lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant Device as Branch Device
    participant SyncAPI as Sync Controller
    participant SyncSvc as Sync Service
    participant Dedupe as Idempotency Guard
    participant EventStore as Event Store
    participant Replay as Replay Worker
    participant Projections as Projection Builder
    participant Audit as Audit Log

    Device->>SyncAPI: POST /api/sync/events batch
    SyncAPI->>SyncSvc: Validate tenant, branch, device, JWT
    SyncSvc->>Dedupe: Check event UUID + device sequence
    alt Duplicate
        Dedupe-->>SyncSvc: Already accepted
        SyncSvc-->>Device: ACK existing result
    else New event
        Dedupe-->>SyncSvc: Accept
        SyncSvc->>EventStore: Persist immutable events
        EventStore-->>SyncSvc: Stored
        SyncSvc->>Replay: Queue replay
        Replay->>Projections: Rebuild affected read models
        Replay->>Audit: Write sync audit entry
        SyncSvc-->>Device: ACK with server cursor
    end
```

## Data Ownership Rules

- `platform.identity` owns credentials, refresh tokens, login attempts, and session revocations.
- `platform.tenant` owns businesses, branches, branch settings, and registered devices.
- `sales.pos` owns orders, order lines, discounts, cashier shifts, and sales state transitions.
- `finance.payments` owns payment records and refund state.
- `inventory.stock` owns the stock ledger and derived on-hand values.
- `platform.sync` owns event envelopes, inbound/outbound cursors, replay checkpoints, and dedupe records.
- `platform.audit` owns append-only audit logs and correlation metadata.

## Cross-Cutting Concerns

| Concern | Approach |
|---|---|
| Transactions | One database transaction per command where event persistence and projection updates must succeed together. |
| Validation | Bean Validation at API boundaries plus domain rule validation inside aggregates. |
| Multi-tenancy | Tenant ID mandatory on all persistent business records and all query filters. |
| Observability | Structured logs, correlation ID, device ID, branch ID, and tenant ID on every request. |
| Security | Spring Security with JWT, refresh tokens, policy-based permission checks, and audit hooks. |
| Background Work | Spring scheduled tasks / async executors for sync replay, retries, cleanup, and report refresh. |

## Future Microservice Migration Readiness

- Module contracts are explicit and should be exposed through interfaces and internal event types.
- Database ownership is logically partitioned by module, even when physically shared.
- Sync, printing, reporting, and notifications are good future extraction candidates because they already operate asynchronously.
- Identity and tenant modules may later become separate services once scale or compliance justifies it.

