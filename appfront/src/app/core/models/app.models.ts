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

export interface CompletedOrder {
  id: string;
  orderNumber: string;
  branchId: string;
  cashierName: string;
  total: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
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
