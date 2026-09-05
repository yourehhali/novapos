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
  { id: 'cat-burgers', name: 'BURGERS', description: 'Hole Mole burgers' },
  { id: 'cat-smash-burgers', name: 'SMASH BURGERS', description: 'Hole Mole smash burgers' },
  { id: 'cat-pasticcio', name: 'PASTICCIO', description: 'Pasticcio selection' },
  { id: 'cat-poutine', name: 'POUTINE', description: 'Poutine selection' },
  { id: 'cat-panozzos', name: 'PANOZZOS', description: 'Panozzos selection' },
  { id: 'cat-pizza-boat', name: 'PIZZA BOAT', description: 'Pizza boat selection' },
  { id: 'cat-tacos', name: 'TACOS', description: 'Tacos selection' },
  { id: 'cat-fries', name: 'FRIES', description: 'Fries and potatoes' },
  { id: 'cat-drinks', name: 'DRINKS', description: 'Cold and hot drinks' },
  { id: 'cat-tapas', name: 'TAPAS', description: 'Tapas selection' },
  { id: 'cat-salades', name: 'SALADES', description: 'Salad selection' },
  { id: 'cat-extras', name: 'EXTRAS', description: 'Extras and add-ons' },
  { id: 'cat-glovo', name: 'GLOVO', description: 'Glovo menu items' },
];

const DEMO_PRODUCTS: Product[] = [
  { id: 'prod-twin-guacamole', name: 'TWIN GUACAMOLE', categoryId: 'cat-burgers', price: 67, currency: 'DH', sku: 'BRG-001', available: true },
  { id: 'prod-my-honey', name: 'MY HONEY', categoryId: 'cat-burgers', price: 47, currency: 'DH', sku: 'BRG-002', available: true },
  { id: 'prod-classic-bite', name: 'CLASSIC BITE', categoryId: 'cat-burgers', price: 43, currency: 'DH', sku: 'BRG-003', available: true },
  { id: 'prod-special-hole-mole', name: 'SPECIAL HOLÉ MOLÉ', categoryId: 'cat-burgers', price: 81, currency: 'DH', sku: 'BRG-004', available: true },
  { id: 'prod-negro-mole', name: 'NEGRO MOLÉ', categoryId: 'cat-burgers', price: 65, currency: 'DH', sku: 'BRG-005', available: true },
  { id: 'prod-nashville', name: 'NASHVILLE', categoryId: 'cat-burgers', price: 57, currency: 'DH', sku: 'BRG-006', available: true },
  { id: 'prod-burger-zwin', name: 'BURGER ZWIN', categoryId: 'cat-burgers', price: 55, currency: 'DH', sku: 'BRG-007', available: true },
  { id: 'prod-dopamine', name: 'DOPAMINE', categoryId: 'cat-burgers', price: 63, currency: 'DH', sku: 'BRG-008', available: true },
  { id: 'prod-el-jefe', name: 'EL JEFE', categoryId: 'cat-burgers', price: 71, currency: 'DH', sku: 'BRG-009', available: true },
  { id: 'prod-dont-forget', name: 'DON’T FORGET', categoryId: 'cat-burgers', price: 95, currency: 'DH', sku: 'BRG-010', available: true },

  { id: 'prod-double-smash-big-boss', name: 'DOUBLE SMASH BIG BOSS', categoryId: 'cat-smash-burgers', price: 65, currency: 'DH', sku: 'SMB-001', available: true },
  { id: 'prod-smash-cheese-onion', name: 'SMASH CHEESE ONION', categoryId: 'cat-smash-burgers', price: 49, currency: 'DH', sku: 'SMB-002', available: true },
  { id: 'prod-classic-smash', name: 'CLASSIC SMASH', categoryId: 'cat-smash-burgers', price: 43, currency: 'DH', sku: 'SMB-003', available: true },
  { id: 'prod-croissant-smash-burger', name: 'CROISSANT SMASH BURGER', categoryId: 'cat-smash-burgers', price: 65, currency: 'DH', sku: 'SMB-004', available: true },
  { id: 'prod-banana-punch', name: 'BANANA PUNCH', categoryId: 'cat-smash-burgers', price: 53, currency: 'DH', sku: 'SMB-005', available: true },
  { id: 'prod-el-pesto', name: 'EL PESTO', categoryId: 'cat-smash-burgers', price: 50, currency: 'DH', sku: 'SMB-006', available: true },
  { id: 'prod-peperroni-vibe', name: 'PEPERRONI VIBE', categoryId: 'cat-smash-burgers', price: 57, currency: 'DH', sku: 'SMB-007', available: true },

  { id: 'prod-diego', name: 'DIEGO', categoryId: 'cat-pasticcio', price: 41, currency: 'DH', sku: 'PAS-001', available: true },
  { id: 'prod-armando', name: 'ARMANDO', categoryId: 'cat-pasticcio', price: 37, currency: 'DH', sku: 'PAS-002', available: true },
  { id: 'prod-maradona', name: 'MARADONA', categoryId: 'cat-pasticcio', price: 39, currency: 'DH', sku: 'PAS-003', available: true },
  { id: 'prod-scampia', name: 'SCAMPIA', categoryId: 'cat-pasticcio', price: 42, currency: 'DH', sku: 'PAS-004', available: true },

  { id: 'prod-quebecois', name: 'QUEBECOIS', categoryId: 'cat-poutine', price: 29, currency: 'DH', sku: 'POU-001', available: true },
  { id: 'prod-la-elvis', name: 'LA ELVIS', categoryId: 'cat-poutine', price: 43, currency: 'DH', sku: 'POU-002', available: true },
  { id: 'prod-la-chicks', name: 'LA CHICKS', categoryId: 'cat-poutine', price: 45, currency: 'DH', sku: 'POU-003', available: true },
  { id: 'prod-smoky', name: 'SMOKY', categoryId: 'cat-poutine', price: 42, currency: 'DH', sku: 'POU-004', available: true },

  { id: 'prod-amigo', name: 'AMIGO', categoryId: 'cat-panozzos', price: 43, currency: 'DH', sku: 'PNZ-001', available: true },
  { id: 'prod-indien', name: 'INDIEN', categoryId: 'cat-panozzos', price: 41, currency: 'DH', sku: 'PNZ-002', available: true },
  { id: 'prod-ternera', name: 'TERNERA', categoryId: 'cat-panozzos', price: 46, currency: 'DH', sku: 'PNZ-003', available: true },
  { id: 'prod-bang-bang-panozzo', name: 'BANG BANG', categoryId: 'cat-panozzos', price: 47, currency: 'DH', sku: 'PNZ-004', available: true },
  { id: 'prod-mix-cheese-panozzo', name: 'MIX CHEESE', categoryId: 'cat-panozzos', price: 53, currency: 'DH', sku: 'PNZ-005', available: true },
  { id: 'prod-pacifico', name: 'PACIFICO', categoryId: 'cat-panozzos', price: 75, currency: 'DH', sku: 'PNZ-006', available: true },
  { id: 'prod-mista', name: 'MISTA', categoryId: 'cat-panozzos', price: 51, currency: 'DH', sku: 'PNZ-007', available: true },
  { id: 'prod-dardar', name: 'DARDAR', categoryId: 'cat-panozzos', price: 49, currency: 'DH', sku: 'PNZ-008', available: true },
  { id: 'prod-tradizione', name: 'TRADIZIONE', categoryId: 'cat-panozzos', price: 49, currency: 'DH', sku: 'PNZ-009', available: true },

  { id: 'prod-pepperoni', name: 'PEPPERONI', categoryId: 'cat-pizza-boat', price: 48, currency: 'DH', sku: 'PBT-001', available: true },
  { id: 'prod-verde', name: 'VERDE', categoryId: 'cat-pizza-boat', price: 45, currency: 'DH', sku: 'PBT-002', available: true },
  { id: 'prod-mediterranea', name: 'MEDITERRANEA', categoryId: 'cat-pizza-boat', price: 55, currency: 'DH', sku: 'PBT-003', available: true },
  { id: 'prod-bolognese', name: 'BOLOGNESE', categoryId: 'cat-pizza-boat', price: 49, currency: 'DH', sku: 'PBT-004', available: true },

  { id: 'prod-poulet-et-champignons', name: 'POULET ET CHAMPIGNONS', categoryId: 'cat-tacos', price: 47, currency: 'DH', sku: 'TAC-001', available: true },
  { id: 'prod-blue', name: 'BLUE', categoryId: 'cat-tacos', price: 47, currency: 'DH', sku: 'TAC-002', available: true },
  { id: 'prod-beefos', name: 'BEEFOS', categoryId: 'cat-tacos', price: 45, currency: 'DH', sku: 'TAC-003', available: true },
  { id: 'prod-king-hole-mole', name: 'KING HOLÉ MOLÉ', categoryId: 'cat-tacos', price: 54, currency: 'DH', sku: 'TAC-004', available: true },
  { id: 'prod-hole-mexito', name: 'HOLÉ MEXITO', categoryId: 'cat-tacos', price: 49, currency: 'DH', sku: 'TAC-005', available: true },
  { id: 'prod-ke', name: 'KE', categoryId: 'cat-tacos', price: 51, currency: 'DH', sku: 'TAC-006', available: true },
  { id: 'prod-lyonnaise', name: 'LYONNAISE', categoryId: 'cat-tacos', price: 44, currency: 'DH', sku: 'TAC-007', available: true },
  { id: 'prod-hola', name: 'HOLA!', categoryId: 'cat-tacos', price: 50, currency: 'DH', sku: 'TAC-008', available: true },

  { id: 'prod-frites', name: 'FRITES', categoryId: 'cat-fries', price: 8, currency: 'DH', sku: 'FRI-001', available: true },
  { id: 'prod-cheesy-fries', name: 'CHEESY FRIES', categoryId: 'cat-fries', price: 16, currency: 'DH', sku: 'FRI-002', available: true },
  { id: 'prod-jalapenos-fries', name: 'JALAPENOS FRIES', categoryId: 'cat-fries', price: 16, currency: 'DH', sku: 'FRI-003', available: true },
  { id: 'prod-doritos-fries', name: 'DORITOS FRIES', categoryId: 'cat-fries', price: 16, currency: 'DH', sku: 'FRI-004', available: true },
  { id: 'prod-pickles-fries', name: 'PICKLES FRIES', categoryId: 'cat-fries', price: 16, currency: 'DH', sku: 'FRI-005', available: true },
  { id: 'prod-potatoes', name: 'POTATOES', categoryId: 'cat-fries', price: 10, currency: 'DH', sku: 'FRI-006', available: true },
  { id: 'prod-cheesy-potatoes', name: 'CHEESY POTATOES', categoryId: 'cat-fries', price: 18, currency: 'DH', sku: 'FRI-007', available: true },
  { id: 'prod-jalapenos-potates', name: 'JALAPENOS POTATES', categoryId: 'cat-fries', price: 18, currency: 'DH', sku: 'FRI-008', available: true },
  { id: 'prod-doritos-potates', name: 'DORITOS POTATES', categoryId: 'cat-fries', price: 18, currency: 'DH', sku: 'FRI-009', available: true },
  { id: 'prod-pickles-potates', name: 'PICKLES POTATES', categoryId: 'cat-fries', price: 18, currency: 'DH', sku: 'FRI-010', available: true },
  { id: 'prod-mole-fries', name: 'MOLE FRIES', categoryId: 'cat-fries', price: 25, currency: 'DH', sku: 'FRI-011', available: true },
  { id: 'prod-guacamole-fries', name: 'GUACAMOLE FRIES', categoryId: 'cat-fries', price: 23, currency: 'DH', sku: 'FRI-012', available: true },
  { id: 'prod-mexicano-fries', name: 'MEXICANO FRIES', categoryId: 'cat-fries', price: 35, currency: 'DH', sku: 'FRI-013', available: true },

  { id: 'prod-eau-minerale-50cl', name: 'EAU MINERALE 50CL', categoryId: 'cat-drinks', price: 5, currency: 'DH', sku: 'DRK-001', available: true },
  { id: 'prod-eau-gazeuse', name: 'EAU GAZEUSE', categoryId: 'cat-drinks', price: 7, currency: 'DH', sku: 'DRK-002', available: true },
  { id: 'prod-boisson-gazeuse-25cl', name: 'BOISSON GAZEUSE 25CL', categoryId: 'cat-drinks', price: 8, currency: 'DH', sku: 'DRK-003', available: true },
  { id: 'prod-boisson-gazeuse-33cl', name: 'BOISSON GAZEUSE 33CL', categoryId: 'cat-drinks', price: 12, currency: 'DH', sku: 'DRK-004', available: true },
  { id: 'prod-oasis', name: 'OASIS', categoryId: 'cat-drinks', price: 13, currency: 'DH', sku: 'DRK-005', available: true },
  { id: 'prod-tymbark', name: 'TYMBARK', categoryId: 'cat-drinks', price: 13, currency: 'DH', sku: 'DRK-006', available: true },
  { id: 'prod-espresso', name: 'ESPRESSO', categoryId: 'cat-drinks', price: 8, currency: 'DH', sku: 'DRK-007', available: true },
  { id: 'prod-americain', name: 'AMERICAIN', categoryId: 'cat-drinks', price: 8, currency: 'DH', sku: 'DRK-008', available: true },
  { id: 'prod-macchiato', name: 'MACCHIATO', categoryId: 'cat-drinks', price: 10, currency: 'DH', sku: 'DRK-009', available: true },
  { id: 'prod-iced-spanish-latte', name: 'ICED SPANISH LATTE', categoryId: 'cat-drinks', price: 20, currency: 'DH', sku: 'DRK-010', available: true },
  { id: 'prod-iced-americano', name: 'ICED AMERICANO', categoryId: 'cat-drinks', price: 15, currency: 'DH', sku: 'DRK-011', available: true },
  { id: 'prod-ice-coffe', name: 'ICE COFFE', categoryId: 'cat-drinks', price: 18, currency: 'DH', sku: 'DRK-012', available: true },

  { id: 'prod-guacamole-con-nachos', name: 'GUACAMOLE CON NACHOS', categoryId: 'cat-tapas', price: 35, currency: 'DH', sku: 'TAP-001', available: true },
  { id: 'prod-honey-crusted-chicken', name: 'HONEY CRUSTED CHICKEN', categoryId: 'cat-tapas', price: 37, currency: 'DH', sku: 'TAP-002', available: true },

  { id: 'prod-capresse', name: 'CAPRESSE', categoryId: 'cat-salades', price: 53, currency: 'DH', sku: 'SAL-001', available: true },
  { id: 'prod-mexicano-salade', name: 'MEXICANO', categoryId: 'cat-salades', price: 49, currency: 'DH', sku: 'SAL-002', available: true },
  { id: 'prod-burrata', name: 'BURRATA', categoryId: 'cat-salades', price: 65, currency: 'DH', sku: 'SAL-003', available: true },

  { id: 'prod-sauce-holemole', name: 'SAUCE HOLEMOLE', categoryId: 'cat-extras', price: 5, currency: 'DH', sku: 'EXT-001', available: true },
  { id: 'prod-sauce-nawhals', name: 'SAUCE NAWHALS', categoryId: 'cat-extras', price: 2, currency: 'DH', sku: 'EXT-002', available: true },
  { id: 'prod-steak-vh', name: 'STEAK VH', categoryId: 'cat-extras', price: 20, currency: 'DH', sku: 'EXT-003', available: true },
  { id: 'prod-steak-smash', name: 'STEAK SMASH', categoryId: 'cat-extras', price: 10, currency: 'DH', sku: 'EXT-004', available: true },
  { id: 'prod-crusted-chicken', name: 'CRUSTED CHICKEN', categoryId: 'cat-extras', price: 18, currency: 'DH', sku: 'EXT-005', available: true },
  { id: 'prod-fromage', name: 'FROMAGE', categoryId: 'cat-extras', price: 8, currency: 'DH', sku: 'EXT-006', available: true },

  { id: 'prod-glovo', name: 'GLOVO', categoryId: 'cat-glovo', price: 0, currency: 'DH', sku: 'GLV-001', available: true },
  { id: 'prod-combo-t', name: 'COMBO T', categoryId: 'cat-glovo', price: 131, currency: 'DH', sku: 'GLV-002', available: true },
  { id: 'prod-combo-h', name: 'COMBO H', categoryId: 'cat-glovo', price: 72, currency: 'DH', sku: 'GLV-003', available: true },
  { id: 'prod-combo-s', name: 'COMBO S', categoryId: 'cat-glovo', price: 134, currency: 'DH', sku: 'GLV-004', available: true },
  { id: 'prod-combo-b', name: 'COMBO B', categoryId: 'cat-glovo', price: 141, currency: 'DH', sku: 'GLV-005', available: true },
  { id: 'prod-combo-m', name: 'COMBO M', categoryId: 'cat-glovo', price: 142, currency: 'DH', sku: 'GLV-006', available: true },
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
