export interface BranchAssignment {
  branchId: string;
  branchName: string;
  defaultDeviceType: string;
}

export interface AuthUser {
  id: string;
  displayName: string;
  tenantId: string;
  businessName: string;
  roles: string[];
  permissions: string[];
  branchAssignments: BranchAssignment[];
}

export interface AuthSessionResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface BootstrapSession {
  tenantId: string;
  businessName: string;
  branchId: string;
  branchName: string;
  timezone: string;
  deviceCode: string;
  deviceType: string;
  lastSyncAt: string;
  enabledFeatures: string[];
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  currency: string;
  sku: string;
  available: boolean;
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export interface DashboardSummary {
  businessName: string;
  branchId: string;
  activeOrders: number;
  revenueToday: number;
  revenueCashToday: number;
  revenueCardToday: number;
  localQueueDepth: number;
  lastSuccessfulSyncAt: string;
  operationalNotes: string[];
}

export interface PrinterConfig {
  id: string;
  name: string;
  target: string;
  protocol: string;
  queueName: string;
  paperWidthMm?: number;
  charactersPerLine?: number;
  printMode?: 'THERMAL' | 'SYSTEM';
  silent?: boolean;
  systemPrinterName?: string;
}

export interface SyncEventEnvelope {
  eventUuid: string;
  tenantId: string;
  branchId: string;
  deviceId: string;
  deviceSequence: number;
  timestamp: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  schemaVersion: number;
  status: 'PENDING' | 'IN_FLIGHT' | 'ACKNOWLEDGED' | 'CONFLICT';
  correlationId?: string;
  causationId?: string;
  payload: Record<string, unknown>;
}

export interface SyncBatchRequest {
  branchId: string;
  deviceId: string;
  lastKnownServerCursor?: string;
  events: SyncEventEnvelope[];
}

export interface SyncBatchResponse {
  acceptedEventUuids: string[];
  duplicateEventUuids: string[];
  conflictedEventUuids: string[];
  serverCursor: string;
}

export interface SyncStatus {
  branchId: string;
  deviceId: string;
  acceptedEvents: number;
  duplicateEvents: number;
  pendingConflicts: number;
  serverCursor: string;
}

export interface QueueEntry extends SyncEventEnvelope {
  localStatus: 'pending' | 'in-flight' | 'acknowledged' | 'conflict';
  retryCount: number;
  createdAt: string;
}

export type OrderStatus = 'PREPARED' | 'PAID';
export type PaymentMethod = 'CASH' | 'CARD' | 'UNPAID';
export type SalesSummaryRange = 'DAY_START' | 'LAST_REPORT';
export type OrderChannel = 'SUR_PLACE' | 'EMPORTER' | 'LIVRAISON';
export type ResourceStatus = 'ACTIVE' | 'INACTIVE';

export interface CashOpening {
  id: string;
  branchId: string;
  dayKey: string;
  amount: number;
  currency: string;
  note?: string;
  operatorName?: string;
  setAt: string;
  lastUpdatedAt: string;
}

export interface FloorTable {
  id: string;
  number: string;
  label: string;
  zone: string;
  capacity: number;
  status: ResourceStatus;
}

export interface DeliveryDriver {
  id: string;
  number: string;
  name: string;
  phone: string;
  vehicle: string;
  status: ResourceStatus;
}

export interface CompletedOrder {
  id: string;
  orderNumber: string;
  branchId: string;
  cashierName: string;
  total: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  channel: OrderChannel;
  tableNumber?: string;
  livreurId?: string;
  deliveryAddress?: string;
  customerPhone?: string;
  lineCount: number;
  lines: PosLine[];
  createdAt: string;
  kitchenPrintedAt?: string;
  paidAt?: string;
  lastUpdatedAt: string;
  version: number;
  /** VAT rate already included in the prices (0.10 dine-in, 0.20 takeaway/delivery). */
  vatRate: number;
  /** VAT amount extracted out of `total` (prices are VAT-inclusive). */
  vatAmount: number;
  /** Net amount excluding VAT: `total - vatAmount`. */
  netTotal: number;
  /** Identifier of the pocket device that pushed the order (used for per-device stats). */
  deviceId?: string;
  /** Human label of the pocket device that pushed the order. */
  deviceLabel?: string;
}

/**
 * Durable, per-key sequence used to build human ticket numbers
 * (T01-001 per table, W00001 delivery, E00001 takeaway).
 */
export interface TicketCounter {
  key: string;
  value: number;
}

export interface PosLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

export interface SalesSummaryEntry {
  orderId: string;
  orderNumber: string;
  paidAt: string;
  total: number;
  currency: string;
}

/**
 * VAT totals for one sales channel. Prices are VAT-inclusive, so `grossTotal`
 * is what was collected, `netTotal` excludes VAT and `vatAmount` is the VAT
 * extracted from it. The rate depends on the channel (10% dine-in, 20%
 * takeaway/delivery).
 */
export interface SalesSummaryVatLine {
  channel: OrderChannel;
  vatRate: number;
  orderCount: number;
  grossTotal: number;
  netTotal: number;
  vatAmount: number;
}

export interface SalesSummaryReport {
  range: SalesSummaryRange;
  branchId: string;
  branchName: string;
  generatedAt: string;
  fromAt: string;
  toAt: string;
  orderCount: number;
  grandTotal: number;
  /** Sum of the VAT-excluded bases. */
  totalNet: number;
  /** Sum of the extracted VAT. */
  totalVat: number;
  currency: string;
  entries: SalesSummaryEntry[];
  /** VAT detail per sales channel, in channel order. */
  vatBreakdown: SalesSummaryVatLine[];
}

export interface ReportPrintState {
  id: string;
  branchId: string;
  reportType: 'SALES_SUMMARY';
  lastPrintedAt: string;
}

export type LogoType = 'TEXT' | 'IMAGE';
export type DemoSeedingMode = 'BLANK' | 'DEMO';

export interface TicketLayoutConfig {
  showBusinessInfo: boolean;
  logoType: LogoType;
  logoText: string;
  logoImageDataUrl: string;
  /** Logo width as a percentage of the printable ticket width (0-100). 0 hides the logo; 100 spans the full width. Aspect ratio is always preserved. */
  logoScale: number;
  heading: string;
  subheading: string;
  footerLine1: string;
  footerLine2: string;
  footerLine3: string;
}

export interface BusinessSettings {
  id: 'current';
  businessName: string;
  businessNameCustomized?: boolean;
  demoDataSignature?: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  taxLabel: string;
  taxNumber: string;
  logoType: LogoType;
  logoText: string;
  logoImageDataUrl: string;
  ticketHeading: string;
  ticketSubheading: string;
  footerLine1: string;
  footerLine2: string;
  footerLine3: string;
  paymentTicket?: TicketLayoutConfig | null;
  kitchenTicket?: TicketLayoutConfig | null;
  demoSeedingMode: DemoSeedingMode;
  receiptPrinterName: string;
  receiptQueueName: string;
  receiptPrinterIp: string;
  receiptPaperWidthMm: 58 | 80;
  kitchenPrinterName: string;
  kitchenQueueName: string;
  kitchenPrinterIp: string;
  kitchenPaperWidthMm: 58 | 80;
  currency: string;
  updatedAt: string;
}

export interface DesktopRuntimeInfo {
  isDesktop: boolean;
  platform: string;
  version: string;
  packaged: boolean;
}

export interface DesktopPrinterInfo {
  name: string;
  displayName?: string;
  description?: string;
  status: number;
  isDefault: boolean;
  options?: Record<string, string>;
}

export interface PrintTicketRequest {
  kind: 'KITCHEN' | 'PAYMENT';
  printer?: PrinterConfig;
  order: CompletedOrder;
  html?: string;
  paperWidthMm?: number;
  systemPrinterName?: string;
  silent?: boolean;
  settings?: BusinessSettings;
}

export interface PrintSalesSummaryRequest {
  printer?: PrinterConfig;
  report: SalesSummaryReport;
  html?: string;
  paperWidthMm?: number;
  systemPrinterName?: string;
  silent?: boolean;
  settings?: BusinessSettings;
}

export interface PrintTicketResult {
  success: boolean;
  message: string;
  printerName?: string;
}

export interface PocketDeviceInfo {
  id: string;
  label: string;
  lastSeenAt: string;
  orderCount: number;
}

export interface PocketServerStatus {
  running: boolean;
  url: string | null;
  address: string | null;
  port: number | null;
  pin: string | null;
  qrDataUrl: string | null;
  devices: PocketDeviceInfo[];
}

export interface PocketOrderLinePayload {
  productId: string;
  quantity: number;
}

export interface PocketIncomingOrder {
  requestId: string;
  channel: OrderChannel;
  tableNumber?: string;
  livreurId?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  note?: string;
  lines: PocketOrderLinePayload[];
  deviceId?: string;
  deviceLabel?: string;
}

export interface PocketOrderResult {
  ok: boolean;
  orderId?: string;
  orderNumber?: string;
  total?: number;
  error?: string;
}

/** Snapshot of one order returned to a pocket device for its own history/stats. */
export interface PocketOrderSummary {
  orderId: string;
  orderNumber: string;
  channel: OrderChannel;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  total: number;
  currency: string;
  tableNumber?: string;
  lineCount: number;
  createdAt: string;
  paidAt?: string;
}

/** Request from a pocket device asking the desktop to settle and print an order. */
export interface PocketPayRequest {
  requestId: string;
  orderId: string;
  paymentMethod: PaymentMethod;
  deviceId?: string;
  deviceLabel?: string;
}

export interface PocketPayResult {
  ok: boolean;
  orderId?: string;
  orderNumber?: string;
  total?: number;
  printed?: boolean;
  error?: string;
}

/** Per-device aggregates computed on the desktop and shown in the pocket app. */
export interface PocketStats {
  orderCount: number;
  paidCount: number;
  unpaidCount: number;
  totalCollected: number;
  currency: string;
}

export interface PocketHistoryPayload {
  orders: PocketOrderSummary[];
  stats: PocketStats;
}

/** Request from a pocket device asking the desktop for its own order history/stats. */
export interface PocketHistoryRequest {
  requestId: string;
  deviceId?: string;
  deviceLabel?: string;
}

export interface PocketCatalogPayload {
  businessName: string;
  currency: string;
  categories: Category[];
  products: Product[];
  tables: FloorTable[];
  drivers: DeliveryDriver[];
}

/* ------------------------------------------------------------------------- *
 * almani-nafris.com WebSocket integration (see pos-websocket-protocol.md).
 * The transport lives in the Electron main process; these types describe the
 * shared protocol envelopes plus the IPC/UI surface used by the renderer.
 * ------------------------------------------------------------------------- */

export type PosWsConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'SYNCHRONIZING'
  | 'AUTH_ERROR';

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

export type PosWsOrderErrorCode =
  | 'invalid_payload'
  | 'empty_order'
  | 'unknown_product'
  | 'product_unavailable'
  | 'session_unavailable'
  | 'pos_unavailable'
  | 'processing_timeout'
  | 'internal_error';

export interface PosWsOrderCreatedPayload {
  channel: OrderChannel;
  tableNumber?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  note?: string;
  lines: PocketOrderLinePayload[];
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

export type PosWsOrderResultPayload = PosWsOrderAckPayload | PosWsOrderErrorPayload;

export interface PosWsOrdersSyncEntry {
  eventId: string;
  orderId: string;
  orderNumber: string;
  total: number;
  channel: OrderChannel;
  createdAt: string;
}

export interface PosWsOrdersSyncPayload {
  branchId: string | null;
  orders: PosWsOrdersSyncEntry[];
}

export interface PosWsSnapshot {
  catalog: PosWsCatalogPayload | null;
  orders: PosWsOrdersSyncEntry[];
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

export interface PosWsConfigView {
  enabled: boolean;
  url: string;
  branchId: string | null;
  deviceId: string | null;
  hasToken: boolean;
  status: PosWsClientStatus;
}

export interface PosWsConfigPatch {
  enabled?: boolean;
  url?: string;
  branchId?: string | null;
  deviceId?: string | null;
  token?: string;
}

export interface PosWsLogEntry {
  id: string;
  at: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  detail?: string;
}

/** Renderer-bound request for an order received from the website. */
export interface PosWsIncomingOrder {
  eventId: string;
  order: PosWsOrderCreatedPayload;
}

/** Renderer-bound request asking for the catalog + processed-order snapshot. */
export interface PosWsSnapshotRequest {
  requestId: string;
}

/**
 * Durable record mapping a website event to the POS order it produced. Used to
 * reject duplicate deliveries so retries never create a second order.
 */
export interface PosWsProcessedEvent {
  eventId: string;
  orderId: string;
  orderNumber: string;
  total: number;
  channel: OrderChannel;
  source: string;
  processedAt: string;
}

export interface PosWsState {
  id: 'current';
  catalogVersion: number;
  catalogHash: string;
  updatedAt: string;
}
