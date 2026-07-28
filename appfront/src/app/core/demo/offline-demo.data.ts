import {
  AuthSessionResponse,
  AuthUser,
  BootstrapSession,
  Category,
  DashboardSummary,
  PrinterConfig,
  Product,
  SyncStatus,
} from '../models/app.models';

const DEMO_TENANT_ID = 'tenant-atlas-bites';
const DEMO_BUSINESS_NAME = 'Atlas Bites Group';
const DEMO_PASSWORD = 'Pass123!';
const OFFLINE_TOKEN_PREFIX = 'offline-demo-token:';

const DEMO_BRANCHES = {
  'branch-oujda': {
    branchId: 'branch-oujda',
    branchName: 'Oujda Flagship',
    timezone: 'Africa/Casablanca',
  },
  'branch-rabat': {
    branchId: 'branch-rabat',
    branchName: 'Rabat Express',
    timezone: 'Africa/Casablanca',
  },
} as const;

const DEMO_USERS: Record<string, AuthUser & { password: string }> = {
  'superadmin@novapos.ma': {
    id: 'user-super-admin',
    displayName: 'Nadia Platform',
    tenantId: DEMO_TENANT_ID,
    businessName: DEMO_BUSINESS_NAME,
    roles: ['SUPER_ADMIN'],
    permissions: ['TENANT_MANAGE', 'BRANCH_MANAGE', 'USER_MANAGE', 'REPORT_VIEW', 'SETTINGS_MANAGE', 'POS_USE', 'SUPPORT_ACCESS'],
    branchAssignments: [
      { branchId: 'branch-oujda', branchName: 'Oujda Flagship', defaultDeviceType: 'POS_TERMINAL' },
      { branchId: 'branch-rabat', branchName: 'Rabat Express', defaultDeviceType: 'POS_TERMINAL' },
    ],
    password: DEMO_PASSWORD,
  },
  'owner@novapos.ma': {
    id: 'user-owner',
    displayName: 'Yassine El Idrissi',
    tenantId: DEMO_TENANT_ID,
    businessName: DEMO_BUSINESS_NAME,
    roles: ['BUSINESS_OWNER'],
    permissions: ['TENANT_MANAGE', 'BRANCH_MANAGE', 'USER_MANAGE', 'REPORT_VIEW', 'SETTINGS_MANAGE', 'POS_USE'],
    branchAssignments: [
      { branchId: 'branch-oujda', branchName: 'Oujda Flagship', defaultDeviceType: 'POS_TERMINAL' },
      { branchId: 'branch-rabat', branchName: 'Rabat Express', defaultDeviceType: 'POS_TERMINAL' },
    ],
    password: DEMO_PASSWORD,
  },
  'manager@novapos.ma': {
    id: 'user-manager',
    displayName: 'Sara Benhaddou',
    tenantId: DEMO_TENANT_ID,
    businessName: DEMO_BUSINESS_NAME,
    roles: ['MANAGER'],
    permissions: ['POS_USE', 'REPORT_VIEW', 'SETTINGS_MANAGE', 'USER_VIEW', 'BRANCH_VIEW'],
    branchAssignments: [
      { branchId: 'branch-oujda', branchName: 'Oujda Flagship', defaultDeviceType: 'POS_TERMINAL' },
    ],
    password: DEMO_PASSWORD,
  },
  'cashier@novapos.ma': {
    id: 'user-cashier',
    displayName: 'Amine El Fassi',
    tenantId: DEMO_TENANT_ID,
    businessName: DEMO_BUSINESS_NAME,
    roles: ['CASHIER'],
    permissions: ['POS_USE', 'PAYMENT_CREATE', 'RECEIPT_PRINT'],
    branchAssignments: [
      { branchId: 'branch-oujda', branchName: 'Oujda Flagship', defaultDeviceType: 'POS_TERMINAL' },
    ],
    password: DEMO_PASSWORD,
  },
  'waiter@novapos.ma': {
    id: 'user-waiter',
    displayName: 'Salma Waiter',
    tenantId: DEMO_TENANT_ID,
    businessName: DEMO_BUSINESS_NAME,
    roles: ['WAITER'],
    permissions: ['POS_USE', 'TABLE_MANAGE', 'KITCHEN_SEND', 'RECEIPT_PRINT'],
    branchAssignments: [
      { branchId: 'branch-oujda', branchName: 'Oujda Flagship', defaultDeviceType: 'POS_TERMINAL' },
    ],
    password: DEMO_PASSWORD,
  },
  'kitchen@novapos.ma': {
    id: 'user-kitchen',
    displayName: 'Khalid Kitchen',
    tenantId: DEMO_TENANT_ID,
    businessName: DEMO_BUSINESS_NAME,
    roles: ['KITCHEN'],
    permissions: ['KITCHEN_VIEW', 'KITCHEN_UPDATE'],
    branchAssignments: [
      { branchId: 'branch-oujda', branchName: 'Oujda Flagship', defaultDeviceType: 'POS_TERMINAL' },
    ],
    password: DEMO_PASSWORD,
  },
  'inventory@novapos.ma': {
    id: 'user-inventory',
    displayName: 'Imane Inventory',
    tenantId: DEMO_TENANT_ID,
    businessName: DEMO_BUSINESS_NAME,
    roles: ['INVENTORY_MANAGER'],
    permissions: ['INVENTORY_VIEW', 'INVENTORY_ADJUST', 'PURCHASING_VIEW', 'PURCHASING_RECEIVE'],
    branchAssignments: [
      { branchId: 'branch-oujda', branchName: 'Oujda Flagship', defaultDeviceType: 'POS_TERMINAL' },
      { branchId: 'branch-rabat', branchName: 'Rabat Express', defaultDeviceType: 'POS_TERMINAL' },
    ],
    password: DEMO_PASSWORD,
  },
  'accountant@novapos.ma': {
    id: 'user-accountant',
    displayName: 'Omar Finance',
    tenantId: DEMO_TENANT_ID,
    businessName: DEMO_BUSINESS_NAME,
    roles: ['ACCOUNTANT'],
    permissions: ['REPORT_VIEW', 'EXPENSE_VIEW', 'INVOICE_VIEW', 'PAYMENT_VIEW'],
    branchAssignments: [
      { branchId: 'branch-rabat', branchName: 'Rabat Express', defaultDeviceType: 'POS_TERMINAL' },
    ],
    password: DEMO_PASSWORD,
  },
};

const DEMO_CATEGORIES: Category[] = [
  { id: 'cat-smash-burgers', name: 'Smash Burgers', description: 'Burgers smash signatures' },
  { id: 'cat-burgers', name: 'Burgers', description: 'Burgers classiques et premium' },
  { id: 'cat-fries-drinks', name: 'Frites & Boissons', description: 'Accompagnements et boissons' },
  { id: 'cat-tacos', name: 'Tacos', description: 'Tacos gratines et recettes signature' },
  { id: 'cat-panozzos', name: 'Panozzos', description: 'Paninis et puccia' },
  { id: 'cat-pizza-boat', name: 'Pizza Boat', description: 'Pizza boat speciales' },
  { id: 'cat-pasticcio-poutine', name: 'Pasticcio & Poutine', description: 'Poutines et pasticcio' },
  { id: 'cat-desserts', name: 'Desserts & Extras', description: 'Selection rapide pour tests' },
];

const DEMO_PRODUCTS: Product[] = [
  { id: 'prod-double-smash-bigboss', name: 'Double Smash Bigboss', categoryId: 'cat-smash-burgers', price: 65, currency: 'MAD', sku: 'SMB-001', available: true },
  { id: 'prod-smash-cheese-onion', name: 'Smash Cheese Onion', categoryId: 'cat-smash-burgers', price: 49, currency: 'MAD', sku: 'SMB-002', available: true },
  { id: 'prod-banana-punch', name: 'Banana Punch', categoryId: 'cat-smash-burgers', price: 53, currency: 'MAD', sku: 'SMB-005', available: true },
  { id: 'prod-twin-guacamole', name: 'Twin Guacamole', categoryId: 'cat-burgers', price: 67, currency: 'MAD', sku: 'BRG-001', available: true },
  { id: 'prod-nashville', name: 'Nashville', categoryId: 'cat-burgers', price: 57, currency: 'MAD', sku: 'BRG-006', available: true },
  { id: 'prod-el-jefe', name: 'El Jefe', categoryId: 'cat-burgers', price: 71, currency: 'MAD', sku: 'BRG-009', available: true },
  { id: 'prod-frites', name: 'Frites', categoryId: 'cat-fries-drinks', price: 8, currency: 'MAD', sku: 'FRD-001', available: true },
  { id: 'prod-espresso', name: 'Espresso', categoryId: 'cat-fries-drinks', price: 8, currency: 'MAD', sku: 'FRD-017', available: true },
  { id: 'prod-iced-spanish-latte', name: 'Iced Spanish Latte', categoryId: 'cat-fries-drinks', price: 20, currency: 'MAD', sku: 'FRD-020', available: true },
  { id: 'prod-poulet-champignons', name: 'Poulet et Champignons', categoryId: 'cat-tacos', price: 47, currency: 'MAD', sku: 'TAC-001', available: true },
  { id: 'prod-bang-bang', name: 'Bang Bang', categoryId: 'cat-tacos', price: 47, currency: 'MAD', sku: 'TAC-008', available: true },
  { id: 'prod-amigo', name: 'Amigo', categoryId: 'cat-panozzos', price: 43, currency: 'MAD', sku: 'PNZ-001', available: true },
  { id: 'prod-pizza-boat-pepperoni', name: 'Pizza Boat Pepperoni', categoryId: 'cat-pizza-boat', price: 48, currency: 'MAD', sku: 'PBT-001', available: true },
  { id: 'prod-diego', name: 'Diego', categoryId: 'cat-pasticcio-poutine', price: 41, currency: 'MAD', sku: 'PPO-001', available: true },
  { id: 'prod-quebecois', name: 'Quebecois', categoryId: 'cat-pasticcio-poutine', price: 29, currency: 'MAD', sku: 'PPO-005', available: true },
  { id: 'prod-caprese', name: 'Caprese', categoryId: 'cat-desserts', price: 35, currency: 'MAD', sku: 'DEX-001', available: true },
  { id: 'prod-burrata', name: 'Burrata', categoryId: 'cat-desserts', price: 65, currency: 'MAD', sku: 'DEX-003', available: true },
];

const DEMO_PRINTERS: PrinterConfig[] = [
  {
    id: 'receipt-main',
    name: 'Front Counter Receipt',
    target: 'RECEIPT',
    protocol: 'ESC_POS',
    queueName: 'EPSON TM-T20II Receipt',
    paperWidthMm: 80,
    charactersPerLine: 42,
    printMode: 'THERMAL',
    silent: true,
    systemPrinterName: 'EPSON TM-T20II Receipt',
  },
  {
    id: 'kitchen-hot',
    name: 'Kitchen Hot Line',
    target: 'KITCHEN',
    protocol: 'ESC_POS',
    queueName: 'EPSON TM-T20II Receipt',
    paperWidthMm: 80,
    charactersPerLine: 42,
    printMode: 'THERMAL',
    silent: true,
    systemPrinterName: 'EPSON TM-T20II Receipt',
  },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function isOfflineDemoToken(token: string | null | undefined): boolean {
  return Boolean(token?.startsWith(OFFLINE_TOKEN_PREFIX));
}

export function getOfflineDemoAuthSession(login: string, password: string): AuthSessionResponse | null {
  const user = DEMO_USERS[login.trim().toLowerCase()];
  if (!user || user.password !== password) {
    return null;
  }

  const { password: _password, ...safeUser } = user;
  return {
    accessToken: `${OFFLINE_TOKEN_PREFIX}${safeUser.id}`,
    refreshToken: `offline-demo-refresh:${safeUser.id}`,
    user: clone(safeUser),
  };
}

export function getOfflineBootstrapSession(
  branchId: string,
  deviceType: string,
  deviceCode?: string,
): BootstrapSession | null {
  const branch = DEMO_BRANCHES[branchId as keyof typeof DEMO_BRANCHES];
  if (!branch) {
    return null;
  }

  return {
    tenantId: DEMO_TENANT_ID,
    businessName: DEMO_BUSINESS_NAME,
    branchId: branch.branchId,
    branchName: branch.branchName,
    timezone: branch.timezone,
    deviceCode: deviceCode || `${branch.branchId.toUpperCase()}-${deviceType.toUpperCase()}`,
    deviceType,
    lastSyncAt: new Date().toISOString(),
    enabledFeatures: ['POS', 'ORDERS', 'SYNC', 'PRINTING'],
  };
}

export function getOfflineDemoCatalog(): { products: Product[]; categories: Category[] } {
  return {
    products: clone(DEMO_PRODUCTS),
    categories: clone(DEMO_CATEGORIES),
  };
}

export function getOfflineDemoPrinters(): PrinterConfig[] {
  return clone(DEMO_PRINTERS);
}

export function getOfflineDemoDashboard(branchId: string): DashboardSummary | null {
  const branch = DEMO_BRANCHES[branchId as keyof typeof DEMO_BRANCHES];
  if (!branch) {
    return null;
  }

  return {
    businessName: DEMO_BUSINESS_NAME,
    branchId: branch.branchId,
    activeOrders: branch.branchId === 'branch-rabat' ? 6 : 12,
    revenueToday: 4870,
    localQueueDepth: 0,
    lastSuccessfulSyncAt: 'Mode demo local',
    operationalNotes: [
      'Mode demo offline actif sur cet appareil',
      'Impression locale disponible selon la configuration desktop',
      'Les evenements restent stockes localement pendant le test',
    ],
  };
}

export function getOfflineDemoSyncStatus(branchId: string, deviceId: string): SyncStatus {
  return {
    branchId,
    deviceId,
    acceptedEvents: 0,
    duplicateEvents: 0,
    pendingConflicts: 0,
    serverCursor: 'OFFLINE-DEMO',
  };
}
