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

export interface SalesSummaryReport {
  range: SalesSummaryRange;
  branchId: string;
  branchName: string;
  generatedAt: string;
  fromAt: string;
  toAt: string;
  orderCount: number;
  grandTotal: number;
  currency: string;
  entries: SalesSummaryEntry[];
}

export interface ReportPrintState {
  id: string;
  branchId: string;
  reportType: 'SALES_SUMMARY';
  lastPrintedAt: string;
}

export type LogoType = 'TEXT' | 'IMAGE';

export interface BusinessSettings {
  id: 'current';
  businessName: string;
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
}

export interface PrintSalesSummaryRequest {
  printer?: PrinterConfig;
  report: SalesSummaryReport;
}

export interface PrintTicketResult {
  success: boolean;
  message: string;
  printerName?: string;
}
