# 06. User Flows

## Login

```mermaid
sequenceDiagram
    autonumber
    participant User
    participant UI as Angular PWA
    participant Local as IndexedDB Session Store
    participant API as Auth API

    User->>UI: Enter credentials
    UI->>API: Authenticate
    API-->>UI: JWT, refresh token, roles, branch access
    UI->>Local: Persist session and permissions snapshot
    UI-->>User: Open role-based workspace
```

## Create Order

```mermaid
sequenceDiagram
    autonumber
    participant Cashier
    participant POS as POS UI
    participant Dexie as Local Projection Store
    participant Queue as Event Queue

    Cashier->>POS: Select products and modifiers
    POS->>Dexie: Create local order projection
    POS->>Queue: Append OrderCreated and OrderLineAdded events
    Dexie-->>POS: Updated cart/order totals
    POS-->>Cashier: Show active order immediately
```

## Kitchen Flow

```mermaid
sequenceDiagram
    autonumber
    participant Cashier
    participant POS as POS UI
    participant Print as Kitchen Printer Mapping
    participant KDS as Kitchen Display
    participant Queue as Event Queue

    Cashier->>POS: Confirm kitchen items
    POS->>Queue: Append KitchenTicketCreated event
    POS->>Print: Print kitchen ticket locally
    Queue-->>KDS: Local projection update
    KDS-->>Cashier: Ticket visible in kitchen workflow
```

## Payment

```mermaid
sequenceDiagram
    autonumber
    participant Cashier
    participant POS as Payment Panel
    participant Dexie as Local Order Projection
    participant Queue as Event Queue

    Cashier->>POS: Choose tender and amount
    POS->>Queue: Append PaymentReceived event
    POS->>Dexie: Update paid balance and order state
    Dexie-->>POS: Payment accepted locally
    POS-->>Cashier: Order marked paid
```

## Receipt

```mermaid
sequenceDiagram
    autonumber
    participant Cashier
    participant POS as POS UI
    participant Receipt as Receipt Renderer
    participant Printer as Receipt Printer
    participant Queue as Event Queue

    Cashier->>POS: Tap print receipt
    POS->>Receipt: Build receipt from local projection
    Receipt->>Printer: Send ESC/POS output
    POS->>Queue: Append ReceiptPrinted audit event
    Printer-->>Cashier: Receipt printed
```

## Inventory Update

```mermaid
sequenceDiagram
    autonumber
    participant Manager
    participant UI as Inventory UI
    participant Dexie as Local Inventory Projection
    participant Queue as Event Queue

    Manager->>UI: Adjust stock quantity
    UI->>Queue: Append InventoryAdjusted event
    UI->>Dexie: Update stock balance locally
    Dexie-->>UI: New on-hand quantity
    UI-->>Manager: Adjustment completed
```

## Offline Sale

```mermaid
sequenceDiagram
    autonumber
    participant Cashier
    participant POS as POS UI
    participant Net as Network Service
    participant Dexie as Local Stores
    participant Queue as Event Queue
    participant Printer as Receipt Printer

    Net-->>POS: Offline detected
    Cashier->>POS: Create and pay order
    POS->>Queue: Append order and payment events
    POS->>Dexie: Update order and stock projections
    POS->>Printer: Print receipt locally
    POS-->>Cashier: Sale completes with no interruption
```

## Internet Recovery

```mermaid
sequenceDiagram
    autonumber
    participant Net as Network Service
    participant Sync as Sync Engine
    participant Queue as Event Queue
    participant API as Sync API

    Net-->>Sync: Connectivity restored
    Sync->>Queue: Load pending events
    Sync->>API: Upload ordered batch
    API-->>Sync: ACK accepted range and conflicts
    Sync->>Queue: Mark acknowledged items
    Sync-->>Net: Sync state healthy
```

## Synchronization

```mermaid
sequenceDiagram
    autonumber
    participant Device
    participant SyncAPI as Sync API
    participant Dedupe as Dedupe Guard
    participant Store as Event Store
    participant Replay as Replay Worker
    participant Projection as Projection Builder

    Device->>SyncAPI: Send event batch
    SyncAPI->>Dedupe: Check UUID and device sequence
    Dedupe-->>SyncAPI: Accept or existing result
    SyncAPI->>Store: Persist immutable events
    Store->>Replay: Queue replay
    Replay->>Projection: Rebuild affected read models
    SyncAPI-->>Device: Return ACK and server cursor
```

## Inventory Count

```mermaid
sequenceDiagram
    autonumber
    participant InventoryManager
    participant UI as Count UI
    participant Dexie as Local Stock Projection
    participant Queue as Event Queue

    InventoryManager->>UI: Start count session
    UI->>Dexie: Snapshot current count baseline
    InventoryManager->>UI: Enter counted quantities
    UI->>Queue: Append InventoryCountSubmitted event
    UI->>Dexie: Replace local stock with counted baseline
    UI-->>InventoryManager: Count posted locally
```

## Purchase Order

```mermaid
sequenceDiagram
    autonumber
    participant Manager
    participant UI as Purchasing UI
    participant Dexie as Local Purchasing Projection
    participant Queue as Event Queue

    Manager->>UI: Create purchase order
    UI->>Queue: Append PurchaseOrderCreated event
    UI->>Dexie: Save local PO projection
    Dexie-->>UI: PO visible in open orders list
    UI-->>Manager: Purchase order created
```

## Receiving Goods

```mermaid
sequenceDiagram
    autonumber
    participant Receiver
    participant UI as Receiving UI
    participant Dexie as Local Inventory Projection
    participant Queue as Event Queue

    Receiver->>UI: Confirm received quantities
    UI->>Queue: Append PurchaseReceived event
    UI->>Dexie: Increase stock balances locally
    Dexie-->>UI: Updated stock and PO status
    UI-->>Receiver: Goods receiving completed
```

## Waste Recording

```mermaid
sequenceDiagram
    autonumber
    participant Staff
    participant UI as Waste UI
    participant Dexie as Local Inventory Projection
    participant Queue as Event Queue

    Staff->>UI: Record damaged or expired stock
    UI->>Queue: Append WasteRecorded event
    UI->>Dexie: Decrease local stock balance
    Dexie-->>UI: Updated on-hand quantity
    UI-->>Staff: Waste recorded
```

## Role Touchpoints Journey

```mermaid
journey
    title Daily User Flow Touchpoints
    section Cashier
      Login and open shift: 5: Cashier
      Create sale and take payment: 5: Cashier
      Print receipt offline if needed: 5: Cashier
    section Waiter and Kitchen
      Send order to kitchen: 5: Waiter
      Prepare and complete ticket: 5: Kitchen
    section Back Office
      Count stock and receive goods: 4: Inventory Manager
      Review reports and sync issues: 4: Manager, Accountant
```

