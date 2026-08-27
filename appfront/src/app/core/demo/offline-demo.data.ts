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
const DEMO_BUSINESS_NAME = 'Hole Mole';
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
  {
    id: 'cat-printing',
    name: 'PRINTING',
    description: 'Printing services',
  },
  {
    id: 'cat-smart',
    name: 'SMART PRODUCTS',
    description: 'Smart NFC products',
  },
];

const DEMO_PRODUCTS: Product[] = [
  {
    id: 'prod-vinyl',
    name: 'VINYL',
    categoryId: 'cat-printing',
    price: 80,
    currency: 'DH',
    sku: 'PRT-001',
    available: true,
  },
  {
    id: 'prod-bache',
    name: 'BÂCHE',
    categoryId: 'cat-printing',
    price: 80,
    currency: 'DH',
    sku: 'PRT-002',
    available: true,
  },
  {
    id: 'prod-smart-business-card',
    name: 'SMART BUSINESS CARD',
    categoryId: 'cat-smart',
    price: 250,
    currency: 'DH',
    sku: 'NFC-001',
    available: true,
  },
  {
    id: 'prod-smart-nfc-stand',
    name: 'SMART NFC STAND',
    categoryId: 'cat-smart',
    price: 350,
    currency: 'DH',
    sku: 'NFC-002',
    available: true,
  },
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

export function getDefaultOfflineAuthSession(): AuthSessionResponse {
  const defaultSession = getOfflineDemoAuthSession('cashier@novapos.ma', DEMO_PASSWORD);
  if (!defaultSession) {
    throw new Error('Default offline demo session is unavailable.');
  }

  return {
    ...defaultSession,
    user: {
      ...defaultSession.user,
      displayName: 'Hole Mole POS',
      businessName: DEMO_BUSINESS_NAME,
      branchAssignments: [
        {
          branchId: 'branch-oujda',
          branchName: 'Hole Mole',
          defaultDeviceType: 'POS_TERMINAL',
        },
      ],
    },
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
    branchName: branch.branchId === 'branch-oujda' ? 'Hole Mole' : branch.branchName,
    timezone: branch.timezone,
    deviceCode: deviceCode || `${branch.branchId.toUpperCase()}-${deviceType.toUpperCase()}`,
    deviceType,
    lastSyncAt: new Date().toISOString(),
    enabledFeatures: ['POS', 'ORDERS', 'SYNC', 'PRINTING'],
  };
}

export function getDefaultOfflineBootstrapSession(): BootstrapSession {
  const branch = getOfflineBootstrapSession('branch-oujda', 'POS_TERMINAL', 'HOLEMOLE-POS-1');
  if (!branch) {
    throw new Error('Default offline demo branch is unavailable.');
  }

  return branch;
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
