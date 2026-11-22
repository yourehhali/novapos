import { app, BrowserWindow, ipcMain, nativeImage, powerMonitor, screen, shell } from 'electron';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { open, writeFile, unlink, type FileHandle } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  PocketServer,
  type PocketCatalogPayload,
  type PocketHistoryPayload,
  type PocketOrderRequest,
  type PocketOrderResult,
  type PocketPayRequest,
  type PocketPayResult,
  type PocketServerStatus,
} from './pocket-server';
import { PosWsClient, type PosWsClientStatus, type PosWsLogEntry, type PosWsOrderResultPayload, type PosWsSnapshot } from './pos-ws-client';
import type { PosWsCatalogPayload, PosWsOrderCreatedPayload } from './ws-protocol';
import { loadPosWsConfig, savePosWsConfig, type PosWsStoredConfig } from './ws-credentials';

type TicketKind = 'KITCHEN' | 'PAYMENT';

interface PrinterProfile {
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

type OrderChannel = 'SUR_PLACE' | 'EMPORTER' | 'LIVRAISON';
type LogoType = 'TEXT' | 'IMAGE';

interface TicketLayoutOverride {
  showBusinessInfo?: boolean;
  logoType?: LogoType;
  logoText?: string;
  logoImageDataUrl?: string;
  logoScale?: number;
  heading?: string;
  subheading?: string;
  footerLine1?: string;
  footerLine2?: string;
  footerLine3?: string;
}

interface ResolvedTicketLayout {
  showBusinessInfo: boolean;
  logoType: LogoType;
  logoText: string;
  logoImageDataUrl: string;
  logoScale: number;
  heading: string;
  subheading: string;
  footerLine1: string;
  footerLine2: string;
  footerLine3: string;
}

interface TicketBusinessSettings {
  businessName?: string;
  addressLine1?: string;
  addressLine2?: string;
  phone?: string;
  taxLabel?: string;
  taxNumber?: string;
  logoType?: LogoType;
  logoText?: string;
  logoImageDataUrl?: string;
  ticketHeading?: string;
  ticketSubheading?: string;
  footerLine1?: string;
  footerLine2?: string;
  footerLine3?: string;
  paymentTicket?: TicketLayoutOverride | null;
  kitchenTicket?: TicketLayoutOverride | null;
  receiptPaperWidthMm?: 58 | 80;
  kitchenPaperWidthMm?: 58 | 80;
  currency?: string;
  updatedAt?: string;
}

const DEFAULT_RESOLVED_LAYOUTS: Record<'payment' | 'kitchen', ResolvedTicketLayout> = {
  payment: {
    showBusinessInfo: true,
    logoType: 'TEXT',
    logoText: '',
    logoImageDataUrl: '',
    logoScale: 50,
    heading: 'Ticket Commande',
    subheading: '',
    footerLine1: 'Merci pour votre visite',
    footerLine2: 'A bientot',
    footerLine3: '',
  },
  kitchen: {
    showBusinessInfo: false,
    logoType: 'TEXT',
    logoText: '',
    logoImageDataUrl: '',
    logoScale: 50,
    heading: 'Ticket Cuisine',
    subheading: '',
    footerLine1: '',
    footerLine2: '',
    footerLine3: '',
  },
};

function resolveTicketLayout(
  settings: TicketBusinessSettings | undefined,
  kind: 'payment' | 'kitchen',
): ResolvedTicketLayout {
  const fallback = DEFAULT_RESOLVED_LAYOUTS[kind];
  if (!settings) return fallback;
  const override = kind === 'kitchen' ? settings.kitchenTicket : settings.paymentTicket;
  const topFallback: ResolvedTicketLayout = kind === 'kitchen'
    ? {
        showBusinessInfo: false,
        logoType: (settings.logoType ?? fallback.logoType) as LogoType,
        logoText: settings.logoText ?? fallback.logoText,
        logoImageDataUrl: settings.logoImageDataUrl ?? fallback.logoImageDataUrl,
        logoScale: fallback.logoScale,
        heading: fallback.heading,
        subheading: '',
        footerLine1: '',
        footerLine2: '',
        footerLine3: '',
      }
    : {
        showBusinessInfo: true,
        logoType: (settings.logoType ?? fallback.logoType) as LogoType,
        logoText: settings.logoText ?? fallback.logoText,
        logoImageDataUrl: settings.logoImageDataUrl ?? fallback.logoImageDataUrl,
        logoScale: fallback.logoScale,
        heading: settings.ticketHeading ?? fallback.heading,
        subheading: settings.ticketSubheading ?? fallback.subheading,
        footerLine1: settings.footerLine1 ?? fallback.footerLine1,
        footerLine2: settings.footerLine2 ?? fallback.footerLine2,
        footerLine3: settings.footerLine3 ?? fallback.footerLine3,
      };
  return {
    showBusinessInfo: override?.showBusinessInfo ?? topFallback.showBusinessInfo,
    logoType: ((override?.logoType ?? topFallback.logoType) || 'TEXT') as LogoType,
    logoText: override?.logoText ?? topFallback.logoText,
    logoImageDataUrl: override?.logoImageDataUrl ?? topFallback.logoImageDataUrl,
    logoScale: override?.logoScale ?? topFallback.logoScale,
    heading: override?.heading ?? topFallback.heading,
    subheading: override?.subheading ?? topFallback.subheading,
    footerLine1: override?.footerLine1 ?? topFallback.footerLine1,
    footerLine2: override?.footerLine2 ?? topFallback.footerLine2,
    footerLine3: override?.footerLine3 ?? topFallback.footerLine3,
  };
}

interface TicketLine {
  name: string;
  quantity: number;
  total: number;
}

interface TicketOrder {
  orderNumber: string;
  cashierName?: string;
  total: number;
  currency: string;
  paymentMethod: string;
  status: string;
  lineCount: number;
  lines: TicketLine[];
  createdAt: string;
  kitchenPrintedAt?: string;
  paidAt?: string;
  channel?: OrderChannel;
  tableNumber?: string;
  livreurId?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  /** VAT rate included in the prices (0.10 dine-in, 0.20 takeaway/delivery). */
  vatRate?: number;
  /** VAT amount extracted out of `total`. */
  vatAmount?: number;
  /** Net amount excluding VAT. */
  netTotal?: number;
}

interface PrintTicketRequest {
  kind: TicketKind;
  printer?: PrinterProfile;
  order: TicketOrder;
  html?: string;
  paperWidthMm?: number;
  systemPrinterName?: string;
  silent?: boolean;
  settings?: TicketBusinessSettings;
}

interface SalesSummaryEntry {
  orderId: string;
  orderNumber: string;
  paidAt: string;
  total: number;
  currency: string;
}

interface SalesSummaryVatLine {
  channel: 'SUR_PLACE' | 'EMPORTER' | 'LIVRAISON';
  vatRate: number;
  orderCount: number;
  grossTotal: number;
  netTotal: number;
  vatAmount: number;
}

interface SalesSummaryReport {
  range: 'DAY_START' | 'LAST_REPORT';
  branchId: string;
  branchName: string;
  generatedAt: string;
  fromAt: string;
  toAt: string;
  orderCount: number;
  grandTotal: number;
  totalNet: number;
  totalVat: number;
  currency: string;
  entries: SalesSummaryEntry[];
  vatBreakdown: SalesSummaryVatLine[];
}

interface PrintSalesSummaryRequest {
  printer?: PrinterProfile;
  report: SalesSummaryReport;
  html?: string;
  paperWidthMm?: number;
  systemPrinterName?: string;
  silent?: boolean;
  settings?: TicketBusinessSettings;
}

type PrintOptionsWithCssPageSize = Electron.WebContentsPrintOptions & {
  preferCSSPageSize?: boolean;
};

type RawPrinterDestination =
  | {
      type: 'network';
      host: string;
      port: number;
      label: string;
    }
  | {
      type: 'queue';
      queueName: string;
      label: string;
    };

const execFileAsync = promisify(execFile);
const BUSINESS_NAME = 'Rox Agency';
const WIFI_PASSWORD = 'ladiesfirst';
const BUNDLED_LOGO_PATH = path.join('electron', 'assets', 'logo-black.png');
const BUNDLED_APP_ICON_PATH = path.join('media', 'icon.png');

let cachedTicketLogo: Electron.NativeImage | null | undefined;
let cachedAppIcon: Electron.NativeImage | null | undefined;

function getAppIcon(): Electron.NativeImage | null {
  if (cachedAppIcon !== undefined) return cachedAppIcon;

  const candidates = [
    path.join(app.getAppPath(), BUNDLED_APP_ICON_PATH),
    path.join(process.cwd(), BUNDLED_APP_ICON_PATH),
  ];
  for (const candidate of candidates) {
    const image = nativeImage.createFromPath(candidate);
    if (!image.isEmpty()) {
      cachedAppIcon = image;
      return cachedAppIcon;
    }
  }
  cachedAppIcon = null;
  return cachedAppIcon;
}

let mainWindow: BrowserWindow | null = null;

/**
 * POS terminals often run on small panels (e.g. 1024x768). Below the desktop
 * sizes the whole renderer is scaled down so every screen keeps the exact same
 * desktop layout instead of falling back to the stacked, narrow shell.
 */
function resolveDisplayScale(): number {
  try {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    if (width > 1200 && height >= 850) {
      return 1;
    }

    const scale = Math.min(width / 1280, height / 960);
    return Math.min(1, Math.max(0.75, scale));
  } catch {
    return 1;
  }
}

/**
 * Re-asserts the renderer scale. Chromium drops the zoom applied through
 * setZoomFactor when the page is recreated (reload, sleep/wake, GPU reset) or
 * when the page is repainted after being covered, so it is re-applied on every
 * event that can lose it. Cheap no-op when the scale is already correct.
 */
function applyDisplayScale(window: BrowserWindow): void {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    return;
  }

  const scale = resolveDisplayScale();
  if (Math.abs(window.webContents.getZoomFactor() - scale) < 0.001) {
    return;
  }

  window.webContents.setZoomFactor(scale);
}

function createMainWindow(): BrowserWindow {
  const appIcon = getAppIcon();
  const isDevelopment = Boolean(process.env['RoxPos_RENDERER_URL']);
  const window = new BrowserWindow({
    width: 1520,
    height: 960,
    minWidth: 1000,
    minHeight: 720,
    fullscreen: !isDevelopment,
    backgroundColor: '#0b0f12',
    autoHideMenuBar: true,
    icon: appIcon ?? undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Read at page creation, so the scale survives reloads and renderer
      // restarts that a one-shot setZoomFactor would not.
      zoomFactor: resolveDisplayScale(),
    },
  });

  // Chromium drops the zoom when the page is recreated or repainted after being
  // covered, so re-assert it on load, navigation, restore and focus.
  window.webContents.on('did-finish-load', () => applyDisplayScale(window));
  window.webContents.on('did-navigate', () => applyDisplayScale(window));
  window.webContents.on('did-navigate-in-page', () => applyDisplayScale(window));
  window.on('show', () => applyDisplayScale(window));
  window.on('restore', () => applyDisplayScale(window));
  window.on('focus', () => applyDisplayScale(window));

  const rendererUrl = process.env['RoxPos_RENDERER_URL'];
  const rendererIndex = path.join(app.getAppPath(), 'dist', 'appfront', 'browser', 'index.html');

  if (rendererUrl) {
    window.loadURL(rendererUrl).catch((error: unknown) => {
      console.error('Unable to load renderer URL', error);
    });
  } else {
    window.loadFile(rendererIndex).catch((error: unknown) => {
      console.error('Unable to load renderer build', error);
    });
  }

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank') {
      return { action: 'allow' };
    }

    shell.openExternal(url).catch(() => undefined);
    return { action: 'deny' };
  });

  return window;
}

let pocketServer: PocketServer | null = null;
const pendingPocketOrders = new Map<string, (result: PocketOrderResult) => void>();
const pendingPocketPay = new Map<string, (result: PocketPayResult) => void>();
const pendingPocketHistory = new Map<string, (payload: PocketHistoryPayload) => void>();

const EMPTY_POCKET_HISTORY: PocketHistoryPayload = {
  orders: [],
  stats: { orderCount: 0, paidCount: 0, unpaidCount: 0, totalCollected: 0, currency: '' },
};

function emptyPocketStatus(): PocketServerStatus {
  return {
    running: false,
    url: null,
    address: null,
    port: null,
    pin: null,
    qrDataUrl: null,
    devices: [],
  };
}

function pocketStaticDir(): string {
  return path.join(app.getAppPath(), 'dist', 'appfront', 'browser', 'pocket');
}

function ensurePocketServer(): PocketServer {
  if (pocketServer) {
    return pocketServer;
  }

  pocketServer = new PocketServer({
    staticDir: pocketStaticDir(),
    handleOrder: (order, meta) => requestRendererOrder(order, meta),
    handleHistory: (meta) => requestRendererHistory(meta),
    handlePay: (pay, meta) => requestRendererPay(pay, meta),
    onStatusChange: (status) => {
      mainWindow?.webContents.send('RoxPos:pocket-status', status);
    },
  });

  return pocketServer;
}

function requestRendererOrder(
  order: PocketOrderRequest,
  meta: { requestId: string; deviceId: string; deviceLabel: string },
): Promise<PocketOrderResult> {
  const window = mainWindow;
  if (!window || window.isDestroyed()) {
    return Promise.resolve({ ok: false, error: 'Caisse indisponible.' });
  }

  return new Promise<PocketOrderResult>((resolve) => {
    pendingPocketOrders.set(meta.requestId, resolve);
    window.webContents.send('RoxPos:pocket-order', {
      requestId: meta.requestId,
      channel: order.channel,
      tableNumber: order.tableNumber,
      livreurId: order.livreurId,
      customerPhone: order.customerPhone,
      deliveryAddress: order.deliveryAddress,
      note: order.note,
      lines: order.lines,
      deviceId: meta.deviceId,
      deviceLabel: meta.deviceLabel,
    });
  });
}

function requestRendererHistory(meta: { deviceId: string; deviceLabel: string }): Promise<PocketHistoryPayload> {
  const window = mainWindow;
  if (!window || window.isDestroyed()) {
    return Promise.resolve(EMPTY_POCKET_HISTORY);
  }

  const requestId = randomBytes(8).toString('hex');
  return new Promise<PocketHistoryPayload>((resolve) => {
    pendingPocketHistory.set(requestId, resolve);
    window.webContents.send('RoxPos:pocket-history', {
      requestId,
      deviceId: meta.deviceId,
      deviceLabel: meta.deviceLabel,
    });
  });
}

function requestRendererPay(
  pay: PocketPayRequest,
  meta: { requestId: string; deviceId: string; deviceLabel: string },
): Promise<PocketPayResult> {
  const window = mainWindow;
  if (!window || window.isDestroyed()) {
    return Promise.resolve({ ok: false, error: 'Caisse indisponible.' });
  }

  return new Promise<PocketPayResult>((resolve) => {
    pendingPocketPay.set(meta.requestId, resolve);
    window.webContents.send('RoxPos:pocket-pay', {
      requestId: meta.requestId,
      orderId: pay.orderId,
      paymentMethod: pay.paymentMethod,
      deviceId: meta.deviceId,
      deviceLabel: meta.deviceLabel,
    });
  });
}

function registerPocketApi(): void {
  ipcMain.handle('RoxPos:pocket-start', async () => ensurePocketServer().start());
  ipcMain.handle('RoxPos:pocket-stop', async () =>
    pocketServer ? pocketServer.stop() : emptyPocketStatus(),
  );
  ipcMain.handle('RoxPos:pocket-status', () =>
    pocketServer ? pocketServer.status() : emptyPocketStatus(),
  );
  ipcMain.handle('RoxPos:pocket-regenerate-pin', () =>
    pocketServer ? pocketServer.regeneratePin() : emptyPocketStatus(),
  );
  ipcMain.handle('RoxPos:pocket-push-data', (_event, payload: PocketCatalogPayload) => {
    ensurePocketServer().setCatalog(payload);
    return { ok: true };
  });
  ipcMain.handle(
    'RoxPos:pocket-resolve-order',
    (_event, requestId: string, result: PocketOrderResult) => {
      const resolve = pendingPocketOrders.get(requestId);
      if (resolve) {
        pendingPocketOrders.delete(requestId);
        resolve(result);
      }
      return { ok: true };
    },
  );
  ipcMain.handle(
    'RoxPos:pocket-resolve-pay',
    (_event, requestId: string, result: PocketPayResult) => {
      const resolve = pendingPocketPay.get(requestId);
      if (resolve) {
        pendingPocketPay.delete(requestId);
        resolve(result);
      }
      return { ok: true };
    },
  );
  ipcMain.handle(
    'RoxPos:pocket-resolve-history',
    (_event, requestId: string, payload: PocketHistoryPayload) => {
      const resolve = pendingPocketHistory.get(requestId);
      if (resolve) {
        pendingPocketHistory.delete(requestId);
        resolve(payload);
      }
      return { ok: true };
    },
  );
}

let posWsClient: PosWsClient | null = null;
let posWsConfig: PosWsStoredConfig | null = null;
const pendingWsOrders = new Map<string, (result: PosWsOrderResultPayload) => void>();
const pendingWsSnapshots = new Map<string, (snapshot: PosWsSnapshot) => void>();

const EMPTY_WS_SNAPSHOT: PosWsSnapshot = { catalog: null, orders: [] };

async function ensurePosWsClient(): Promise<PosWsClient> {
  if (posWsClient) {
    return posWsClient;
  }

  posWsConfig = posWsConfig ?? (await loadPosWsConfig());
  posWsClient = new PosWsClient({
    config: { ...posWsConfig, posVersion: app.getVersion() },
    handleOrder: (eventId, order) => requestRendererWsOrder(eventId, order),
    requestSnapshot: () => requestRendererWsSnapshot(),
    onStatus: (status: PosWsClientStatus) => {
      mainWindow?.webContents.send('RoxPos:ws-status', status);
    },
    onLog: (entry: PosWsLogEntry) => {
      mainWindow?.webContents.send('RoxPos:ws-log', entry);
    },
  });

  return posWsClient;
}

function requestRendererWsOrder(
  eventId: string,
  order: PosWsOrderCreatedPayload,
): Promise<PosWsOrderResultPayload> {
  const window = mainWindow;
  if (!window || window.isDestroyed()) {
    return Promise.resolve({ ok: false, code: 'pos_unavailable', message: 'Caisse indisponible.' });
  }

  return new Promise<PosWsOrderResultPayload>((resolve) => {
    pendingWsOrders.set(eventId, resolve);
    window.webContents.send('RoxPos:ws-order', { eventId, order });
  });
}

function requestRendererWsSnapshot(): Promise<PosWsSnapshot> {
  const window = mainWindow;
  if (!window || window.isDestroyed()) {
    return Promise.resolve(EMPTY_WS_SNAPSHOT);
  }

  const requestId = randomBytes(8).toString('hex');
  return new Promise<PosWsSnapshot>((resolve) => {
    pendingWsSnapshots.set(requestId, resolve);
    window.webContents.send('RoxPos:ws-snapshot-request', { requestId });
  });
}

function registerPosWsApi(): void {
  ipcMain.handle('RoxPos:ws-get-status', async () => (await ensurePosWsClient()).status());

  ipcMain.handle('RoxPos:ws-get-config', async () => {
    const client = await ensurePosWsClient();
    const config = posWsConfig ?? (await loadPosWsConfig());
    return {
      enabled: config.enabled,
      url: config.url,
      branchId: config.branchId,
      deviceId: config.deviceId,
      hasToken: Boolean(config.token),
      status: client.status(),
    };
  });

  ipcMain.handle('RoxPos:ws-set-config', async (_event, patch: Partial<PosWsStoredConfig>) => {
    const client = await ensurePosWsClient();
    const current = posWsConfig ?? (await loadPosWsConfig());
    const next: PosWsStoredConfig = {
      enabled: patch.enabled ?? current.enabled,
      url: (patch.url ?? current.url).trim(),
      branchId: patch.branchId !== undefined ? patch.branchId : current.branchId,
      deviceId: patch.deviceId !== undefined ? patch.deviceId : current.deviceId,
      tenantId: patch.tenantId !== undefined ? patch.tenantId : current.tenantId,
      token: patch.token !== undefined ? patch.token.trim() : current.token,
    };
    posWsConfig = await savePosWsConfig(next);
    return client.updateConfig({ ...posWsConfig, posVersion: app.getVersion() });
  });

  ipcMain.handle('RoxPos:ws-connect', async () => (await ensurePosWsClient()).start());

  ipcMain.handle('RoxPos:ws-disconnect', async () => (await ensurePosWsClient()).stop());

  ipcMain.handle('RoxPos:ws-push-catalog', async (_event, catalog: PosWsCatalogPayload) => {
    const client = await ensurePosWsClient();
    client.pushCatalog(catalog);
    return { ok: true };
  });

  ipcMain.handle('RoxPos:ws-get-logs', async () => (await ensurePosWsClient()).getLogs());

  ipcMain.handle(
    'RoxPos:ws-resolve-order',
    (_event, eventId: string, result: PosWsOrderResultPayload) => {
      const resolve = pendingWsOrders.get(eventId);
      if (resolve) {
        pendingWsOrders.delete(eventId);
        resolve(result);
      }
      return { ok: true };
    },
  );

  ipcMain.handle(
    'RoxPos:ws-resolve-snapshot',
    (_event, requestId: string, snapshot: PosWsSnapshot) => {
      const resolve = pendingWsSnapshots.get(requestId);
      if (resolve) {
        pendingWsSnapshots.delete(requestId);
        resolve(snapshot);
      }
      return { ok: true };
    },
  );
}

function registerDesktopApi(): void {
  ipcMain.handle('RoxPos:desktop-info', async () => ({
    isDesktop: true,
    platform: process.platform,
    version: app.getVersion(),
    packaged: app.isPackaged,
  }));

  ipcMain.handle('RoxPos:list-printers', async () => {
    if (!mainWindow) {
      return [];
    }

    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers.map((printer) => ({
      name: printer.name,
      displayName: printer.displayName,
      description: printer.description,
      status: printer.status,
      isDefault: printer.isDefault,
      options: printer.options,
    }));
  });

  ipcMain.handle('RoxPos:print-ticket', async (_event, request: PrintTicketRequest) =>
    printTicket(request),
  );
  ipcMain.handle('RoxPos:print-sales-summary', async (_event, request: PrintSalesSummaryRequest) =>
    printSalesSummary(request),
  );
  ipcMain.handle('RoxPos:quit-app', () => {
    app.quit();
  });
}

async function printTicket(request: PrintTicketRequest): Promise<{
  success: boolean;
  message: string;
  printerName?: string;
}> {
  try {
    const payload = buildTicketEscPosPayload(request);
    const result = await dispatchEscPosPayload(request.printer, payload);
    return {
      success: true,
      message: 'Ticket imprime via ESC/POS.',
      printerName: result.printerName,
    };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, 'ESC/POS printing failed.'),
      printerName: resolveConfiguredPrinterName(request.printer),
    };
  }
}

async function printSalesSummary(request: PrintSalesSummaryRequest): Promise<{
  success: boolean;
  message: string;
  printerName?: string;
}> {
  try {
    const payload = buildSalesSummaryEscPosPayload(request);
    const result = await dispatchEscPosPayload(request.printer, payload);
    return {
      success: true,
      message: 'Total imprime via ESC/POS.',
      printerName: result.printerName,
    };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, 'ESC/POS summary printing failed.'),
      printerName: resolveConfiguredPrinterName(request.printer),
    };
  }
}

async function dispatchEscPosPayload(
  printer: PrinterProfile | undefined,
  payload: Buffer,
): Promise<{ printerName: string }> {
  const destination = resolveRawPrinterDestination(printer);

  if (destination.type === 'network') {
    await sendToNetworkPrinter(destination, payload);
  } else {
    await sendToSystemPrinterQueue(destination, payload);
  }

  return {
    printerName: destination.label,
  };
}

function resolveRawPrinterDestination(printer: PrinterProfile | undefined): RawPrinterDestination {
  const configuredValues = [printer?.systemPrinterName, printer?.queueName, printer?.name]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  const protocol = (printer?.protocol ?? '').trim().toUpperCase();
  const explicitNetwork = protocol.includes('NETWORK') || protocol.includes('TCP');

  for (const candidate of configuredValues) {
    const endpoint = parseNetworkEndpoint(candidate, explicitNetwork);
    if (endpoint) {
      return {
        type: 'network',
        host: endpoint.host,
        port: endpoint.port,
        label: `${endpoint.host}:${endpoint.port}`,
      };
    }
  }

  const queueName = configuredValues[0];
  if (!queueName) {
    throw new Error('No printer queue or network endpoint is configured for this ticket.');
  }

  return {
    type: 'queue',
    queueName,
    label: queueName,
  };
}

function parseNetworkEndpoint(
  value: string,
  allowBareHost: boolean,
): { host: string; port: number } | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const schemeMatch = trimmed.match(/^(tcp|socket|raw):\/\/(.+)$/i);
  const candidate = schemeMatch ? schemeMatch[2] : trimmed;
  const hasExplicitScheme = Boolean(schemeMatch);
  const explicitPortMatch = candidate.match(/^(.+):(\d{2,5})$/);
  const ipv4Match = candidate.match(/^(\d{1,3}\.){3}\d{1,3}$/);
  const hostnameWithDot = candidate.includes('.');

  if (!hasExplicitScheme && !explicitPortMatch && !ipv4Match && !hostnameWithDot && !allowBareHost) {
    return null;
  }

  if (explicitPortMatch) {
    return {
      host: explicitPortMatch[1],
      port: Number(explicitPortMatch[2]),
    };
  }

  return {
    host: candidate,
    port: 9100,
  };
}

async function sendToNetworkPrinter(
  destination: Extract<RawPrinterDestination, { type: 'network' }>,
  payload: Buffer,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection(
      {
        host: destination.host,
        port: destination.port,
      },
      () => {
        // Resolve as soon as the payload is flushed to the printer instead of
        // waiting for the printer to close the TCP connection: many thermal
        // printers keep the socket open, which made finished prints look like
        // they were still in progress until the inactivity timeout fired.
        socket.end(payload, () => resolve());
      },
    );

    socket.setTimeout(5000);
    socket.on('timeout', () => {
      socket.destroy(new Error(`Timed out while connecting to ${destination.host}:${destination.port}.`));
    });
    socket.on('error', (error) => reject(error));
  });
}

async function sendToSystemPrinterQueue(
  destination: Extract<RawPrinterDestination, { type: 'queue' }>,
  payload: Buffer,
): Promise<void> {
  // Windows: writing straight to the printer port (e.g. \\.\USB001) bypasses
  // PowerShell and the spooler, which is what made USB printers take seconds
  // per ticket. Falls back to the spooler when the port is not writable.
  if (process.platform === 'win32') {
    const portName = await resolveWindowsPrinterPort(destination.queueName);
    if (portName && (await tryWriteWindowsPrinterPort(portName, payload))) {
      return;
    }
  }

  const tempFilePath = path.join(
    os.tmpdir(),
    `RoxPos-escpos-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`,
  );

  await writeFile(tempFilePath, payload);

  try {
    if (process.platform === 'win32') {
      await sendToWindowsRawQueue(destination.queueName, tempFilePath);
      return;
    }

    const lpResult = await tryExecRawQueueCommand('lp', ['-d', destination.queueName, '-o', 'raw', tempFilePath]);
    if (lpResult) {
      return;
    }

    const lprResult = await tryExecRawQueueCommand('lpr', ['-P', destination.queueName, '-l', tempFilePath]);
    if (lprResult) {
      return;
    }

    throw new Error('Neither lp nor lpr is available to send RAW ESC/POS data to the printer queue.');
  } finally {
    await unlink(tempFilePath).catch(() => undefined);
  }
}

/** Cached spooler port per Windows printer; resolved once per app run. */
const windowsPrinterPortCache = new Map<string, string | null>();

/**
 * Resolves the spooler port backing a Windows printer (e.g. "USB001"). The
 * lookup shells out to Get-Printer, so the result is cached for the process
 * lifetime and never resolved per ticket.
 */
async function resolveWindowsPrinterPort(printerName: string): Promise<string | null> {
  const cached = windowsPrinterPortCache.get(printerName);
  if (cached !== undefined) {
    return cached;
  }

  let portName: string | null = null;
  try {
    const script = `(Get-Printer -Name '${escapePowerShellLiteral(printerName)}' -ErrorAction Stop).PortName`;
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true },
    );
    portName = String(stdout).trim() || null;
  } catch {
    portName = null;
  }

  windowsPrinterPortCache.set(printerName, portName);
  return portName;
}

/**
 * Writes ESC/POS bytes directly to a Windows printer port. Returns false when
 * the port cannot be opened for writing (locked by the driver, not a raw port,
 * ...) so the caller can fall back to the printing spooler.
 */
async function tryWriteWindowsPrinterPort(portName: string, payload: Buffer): Promise<boolean> {
  let handle: FileHandle | null = null;
  try {
    handle = await open(`\\\\.\\${portName}`, 'r+');
    await handle.write(payload);
    return true;
  } catch {
    return false;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function tryExecRawQueueCommand(command: string, args: string[]): Promise<boolean> {
  try {
    await execFileAsync(command, args, {
      windowsHide: true,
    });
    return true;
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stderr?: string };
    if (failure.code === 'ENOENT') {
      return false;
    }

    throw new Error(failure.stderr?.trim() || failure.message || `Failed to run ${command}.`);
  }
}

async function sendToWindowsRawQueue(queueName: string, tempFilePath: string): Promise<void> {
  const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)]
    public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)]
    public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)]
    public string pDataType;
  }

  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern int StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

  [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

  public static bool SendBytesToPrinter(string printerName, byte[] bytes) {
    IntPtr printerHandle;
    if (!OpenPrinter(printerName, out printerHandle, IntPtr.Zero)) {
      return false;
    }

    bool docStarted = false;
    bool pageStarted = false;
    IntPtr unmanagedBytes = IntPtr.Zero;

    try {
      DOCINFOA docInfo = new DOCINFOA();
      docInfo.pDocName = "RoxPos ESC_POS";
      docInfo.pDataType = "RAW";

      if (StartDocPrinter(printerHandle, 1, docInfo) == 0) {
        return false;
      }
      docStarted = true;

      if (!StartPagePrinter(printerHandle)) {
        return false;
      }
      pageStarted = true;

      unmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
      Marshal.Copy(bytes, 0, unmanagedBytes, bytes.Length);

      int bytesWritten = 0;
      bool success = WritePrinter(printerHandle, unmanagedBytes, bytes.Length, out bytesWritten);
      return success && bytesWritten == bytes.Length;
    } finally {
      if (unmanagedBytes != IntPtr.Zero) {
        Marshal.FreeCoTaskMem(unmanagedBytes);
      }
      if (pageStarted) {
        EndPagePrinter(printerHandle);
      }
      if (docStarted) {
        EndDocPrinter(printerHandle);
      }
      ClosePrinter(printerHandle);
    }
  }
}
"@

$printerName = '${escapePowerShellLiteral(queueName)}'
$filePath = '${escapePowerShellLiteral(tempFilePath)}'
$bytes = [System.IO.File]::ReadAllBytes($filePath)

if (-not [RawPrinterHelper]::SendBytesToPrinter($printerName, $bytes)) {
  $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  throw "RAW printer write failed with Win32 error $errorCode."
}
`;

  try {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      {
        windowsHide: true,
      },
    );
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stderr?: string };
    throw new Error(failure.stderr?.trim() || failure.message || 'RAW Windows printing failed.');
  }
}

function buildTicketEscPosPayload(request: PrintTicketRequest): Buffer {
  const width = getCharactersPerLine(request.printer);
  const chunks: Buffer[] = [];
  const printedAt = formatDateTime(
    request.kind === 'KITCHEN'
      ? request.order.kitchenPrintedAt || request.order.createdAt
      : request.order.paidAt || request.order.createdAt,
  );

  const headerMeta: string[] = [
    `${request.kind === 'KITCHEN' ? 'PREPARE' : 'PAYE'} ${printedAt}`,
  ];
  for (const line of formatChannelEscPos(request.order)) {
    headerMeta.push(line);
  }

  chunks.push(escposInit());
  appendTicketHeader(
    chunks,
    request.printer,
    request.kind === 'KITCHEN' ? 'kitchen' : 'payment',
    request.kind === 'KITCHEN' ? 'TICKET CUISINE' : 'TICKET PAIEMENT',
    headerMeta,
    request.settings,
    request.order.orderNumber,
  );
  chunks.push(alignLeft());
  chunks.push(textLine('-'.repeat(width)));

  if (request.kind === 'PAYMENT') {
    chunks.push(textLine(lineWithRightAlignedTail('ARTICLE', 'PRIX', width)));
    chunks.push(textLine('-'.repeat(width)));
    for (const line of request.order.lines) {
      for (const renderedLine of formatPaymentEntry(line, width, request.order.currency)) {
        chunks.push(textLine(renderedLine));
      }
    }
    chunks.push(textLine('-'.repeat(width)));
    chunks.push(bold(true));
    chunks.push(textLine(twoColumnLine('TOTAL TTC', formatMoney(request.order.total, request.order.currency), width)));
    chunks.push(bold(false));
    for (const row of paymentVatRows(request.order)) {
      chunks.push(textLine(twoColumnLine(row.label, row.value, width)));
    }
    chunks.push(textLine(twoColumnLine('PAIEMENT', sanitizeForEscPos(formatPaymentMethod(request.order.paymentMethod).toUpperCase()), width)));
    chunks.push(openDrawerPulse());
  } else {
    chunks.push(textLine('ARTICLE'));
    chunks.push(textLine('-'.repeat(width)));
    for (const line of request.order.lines) {
      for (const renderedLine of formatKitchenEntry(line, width)) {
        chunks.push(textLine(renderedLine));
      }
    }
    chunks.push(textLine('-'.repeat(width)));
    chunks.push(textLine(twoColumnLine('LIGNES', String(request.order.lineCount), width)));
  }

  const footerLines = buildFooterEscPos(
    request.settings,
    request.kind === 'KITCHEN' ? 'kitchen' : 'payment',
    width,
  );
  if (footerLines.length > 0) {
    chunks.push(textLine('-'.repeat(width)));
    chunks.push(alignCenter());
    for (const line of footerLines) {
      chunks.push(textLine(line));
    }
    chunks.push(alignLeft());
  }

  chunks.push(feedLines(3));
  chunks.push(cutPaper());
  return Buffer.concat(chunks);
}

function buildSalesSummaryEscPosPayload(request: PrintSalesSummaryRequest): Buffer {
  const width = getCharactersPerLine(request.printer);
  const chunks: Buffer[] = [];
  const title =
    request.report.range === 'DAY_START' ? 'TOTAL DEBUT JOURNEE' : 'TOTAL DEPUIS DERNIER';

  chunks.push(escposInit());
  appendTicketHeader(chunks, request.printer, 'payment', title, [
    request.report.branchName || request.settings?.businessName?.trim() || BUSINESS_NAME,
    formatDateTime(request.report.generatedAt),
  ], request.settings);
  chunks.push(alignLeft());
  chunks.push(textLine('-'.repeat(width)));
  chunks.push(textLine(`DE ${sanitizeForEscPos(formatDateTime(request.report.fromAt))}`));
  chunks.push(textLine(`A  ${sanitizeForEscPos(formatDateTime(request.report.toAt))}`));
  chunks.push(textLine('-'.repeat(width)));
  chunks.push(textLine(formatColumns(['HEURE', 'COMMANDE', 'MONTANT'], [5, width - 17, 12], ['left', 'left', 'right'])));
  chunks.push(textLine('-'.repeat(width)));

  if (request.report.entries.length === 0) {
    chunks.push(textLine('AUCUNE COMMANDE PAYEE'));
  } else {
    for (const entry of request.report.entries) {
      for (const renderedLine of formatSummaryEntry(entry, width)) {
        chunks.push(textLine(renderedLine));
      }
    }
  }

  if (request.report.vatBreakdown.length > 0) {
    chunks.push(textLine('-'.repeat(width)));
    chunks.push(textLine('TVA PAR TYPE DE COMMANDE'));
    for (const line of request.report.vatBreakdown) {
      chunks.push(
        textLine(
          formatColumns(
            [summaryChannelLabel(line.channel), formatVatRate(line.vatRate), `COM: ${line.orderCount}`],
            [Math.max(12, width - 16), 6, 8],
            ['left', 'left', 'right'],
          ),
        ),
      );
      chunks.push(textLine(twoColumnLine('  TTC', formatMoney(line.grossTotal, request.report.currency), width)));
      chunks.push(textLine(twoColumnLine('  HT', formatMoney(line.netTotal, request.report.currency), width)));
      chunks.push(textLine(twoColumnLine('  TVA', formatMoney(line.vatAmount, request.report.currency), width)));
    }
  }

  chunks.push(textLine('-'.repeat(width)));
  chunks.push(textLine(twoColumnLine('TOTAL COMMANDES', String(request.report.orderCount), width)));
  chunks.push(bold(true));
  chunks.push(textLine(twoColumnLine('TOTAL TTC', formatMoney(request.report.grandTotal, request.report.currency), width)));
  chunks.push(bold(false));
  chunks.push(textLine(twoColumnLine('TOTAL HT', formatMoney(request.report.totalNet, request.report.currency), width)));
  chunks.push(textLine(twoColumnLine('TOTAL TVA', formatMoney(request.report.totalVat, request.report.currency), width)));

  const summaryFooterLines = buildFooterEscPos(request.settings, 'payment', width);
  if (summaryFooterLines.length > 0) {
    chunks.push(textLine('-'.repeat(width)));
    chunks.push(alignCenter());
    for (const line of summaryFooterLines) {
      chunks.push(textLine(line));
    }
    chunks.push(alignLeft());
  }

  chunks.push(feedLines(3));
  chunks.push(cutPaper());
  return Buffer.concat(chunks);
}

function getCharactersPerLine(printer: PrinterProfile | undefined): number {
  if (printer?.charactersPerLine && printer.charactersPerLine > 0) {
    return printer.charactersPerLine;
  }

  return (printer?.paperWidthMm ?? 80) <= 58 ? 32 : 42;
}

function formatPaymentEntry(line: TicketLine, width: number, currency: string): string[] {
  const amount = formatMoney(line.total, currency);
  const wrappedName = wrapText(
    sanitizeForEscPos(`${line.quantity} x ${line.name}`),
    Math.max(8, width - amount.length - 1),
  );
  const formattedLines = [lineWithRightAlignedTail(wrappedName[0], amount, width)];

  for (const continuation of wrappedName.slice(1)) {
    formattedLines.push(continuation);
  }

  return formattedLines;
}

function formatKitchenEntry(line: TicketLine, width: number): string[] {
  return wrapText(sanitizeForEscPos(`${line.quantity} x ${line.name}`), width);
}

function formatSummaryEntry(entry: SalesSummaryEntry, width: number): string[] {
  const timeWidth = 5;
  const amountWidth = width <= 32 ? 10 : 12;
  const orderWidth = Math.max(8, width - timeWidth - amountWidth - 2);
  const wrappedOrderNumber = wrapText(sanitizeForEscPos(entry.orderNumber), orderWidth);
  const formattedLines = [
    formatColumns(
      [formatTime(entry.paidAt), wrappedOrderNumber[0], formatMoney(entry.total, entry.currency)],
      [timeWidth, orderWidth, amountWidth],
      ['left', 'left', 'right'],
    ),
  ];

  for (const continuation of wrappedOrderNumber.slice(1)) {
    formattedLines.push(formatColumns(['', continuation, ''], [timeWidth, orderWidth, amountWidth], ['left', 'left', 'right']));
  }

  return formattedLines;
}

function formatColumns(
  values: string[],
  widths: number[],
  alignments: Array<'left' | 'right'>,
): string {
  return values
    .map((value, index) => fitText(value, widths[index], alignments[index]))
    .join(' ')
    .slice(0, widths.reduce((sum, width) => sum + width, 0) + values.length - 1);
}

function fitText(value: string, width: number, alignment: 'left' | 'right'): string {
  const truncated = sanitizeForEscPos(value).slice(0, width);
  return alignment === 'right' ? truncated.padStart(width, ' ') : truncated.padEnd(width, ' ');
}

function wrapText(value: string, width: number): string[] {
  const normalized = sanitizeForEscPos(value).replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [''];
  }

  const words = normalized.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
      continue;
    }

    if (`${currentLine} ${word}`.length <= width) {
      currentLine = `${currentLine} ${word}`;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.flatMap((line) => splitLongToken(line, width));
}

function splitLongToken(value: string, width: number): string[] {
  if (value.length <= width) {
    return [value];
  }

  const parts: string[] = [];
  for (let index = 0; index < value.length; index += width) {
    parts.push(value.slice(index, index + width));
  }
  return parts;
}

function twoColumnLine(left: string, right: string, width: number): string {
  const sanitizedLeft = sanitizeForEscPos(left);
  const sanitizedRight = sanitizeForEscPos(right);
  const availableLeft = Math.max(1, width - sanitizedRight.length - 1);
  return `${sanitizedLeft.slice(0, availableLeft).padEnd(availableLeft, ' ')} ${sanitizedRight}`;
}

function lineWithRightAlignedTail(left: string, right: string, width: number): string {
  const sanitizedLeft = sanitizeForEscPos(left);
  const sanitizedRight = sanitizeForEscPos(right);
  const availableLeft = Math.max(1, width - sanitizedRight.length - 1);
  return `${sanitizedLeft.slice(0, availableLeft).padEnd(availableLeft, ' ')} ${sanitizedRight}`;
}

function centerText(value: string, width: number): string {
  const normalized = sanitizeForEscPos(value).slice(0, width);
  const leftPadding = Math.max(0, Math.floor((width - normalized.length) / 2));
  return `${' '.repeat(leftPadding)}${normalized}`;
}

function appendTicketHeader(
  chunks: Buffer[],
  printer: PrinterProfile | undefined,
  kind: 'payment' | 'kitchen',
  title: string,
  metaLines: string[],
  settings: TicketBusinessSettings | undefined,
  emphasizedLine?: string,
): void {
  const width = getCharactersPerLine(printer);
  const layout = resolveTicketLayout(settings, kind);
  const businessName = settings?.businessName?.trim() || BUSINESS_NAME;
  const heading = layout.heading?.trim() || title;
  const subheading = layout.subheading?.trim();

  chunks.push(alignCenter());
  // An IMAGE logo shrunk to 0% is intentionally hidden, so skip both the raster
  // and the text fallback instead of printing the business name instead.
  const imageLogoSuppressed = layout.logoType === 'IMAGE' && (layout.logoScale ?? 50) <= 0;
  const logoChunk = imageLogoSuppressed ? null : buildLogoEscPosChunk(printer, layout);
  if (logoChunk) chunks.push(logoChunk);

  if (!imageLogoSuppressed && (!logoChunk || layout.logoType !== 'IMAGE')) {
    const logoTextSource = layout.logoType === 'TEXT' && layout.logoText?.trim()
      ? layout.logoText.trim()
      : layout.logoText?.trim() || businessName;
    chunks.push(bold(true));
    for (const line of wrapText(sanitizeForEscPos(logoTextSource), width)) {
      chunks.push(textLine(line));
    }
    chunks.push(bold(false));
  }

  if (layout.showBusinessInfo) {
    const businessInfoLines = buildBusinessInfoEscPos(settings, width);
    for (const line of businessInfoLines) {
      chunks.push(textLine(line));
    }
  }

  chunks.push(doubleHeightWidth(true));
  for (const line of wrapText(sanitizeForEscPos(heading), width)) {
    chunks.push(textLine(line));
  }
  chunks.push(doubleHeightWidth(false));
  if (subheading) {
    for (const line of wrapText(sanitizeForEscPos(subheading), width)) {
      chunks.push(textLine(line));
    }
  }

  // The ticket ID (T01-001, W00001, E00001) is the key identifier staff look
  // for, so it is printed bold and at double height/width. Double-width glyphs
  // halve the usable character columns, hence the width / 2 wrapping.
  if (emphasizedLine?.trim()) {
    chunks.push(bold(true));
    chunks.push(doubleHeightWidth(true));
    for (const line of wrapText(sanitizeForEscPos(emphasizedLine.trim()), Math.max(4, Math.floor(width / 2)))) {
      chunks.push(textLine(line));
    }
    chunks.push(doubleHeightWidth(false));
    chunks.push(bold(false));
  }

  for (const metaLine of metaLines) {
    chunks.push(textLine(metaLine));
  }
}

function buildBusinessInfoEscPos(settings: TicketBusinessSettings | undefined, width: number): string[] {
  if (!settings) return [];
  const lines: string[] = [];
  const details: string[] = [];
  if (settings.addressLine1?.trim()) details.push(settings.addressLine1.trim());
  if (settings.addressLine2?.trim()) details.push(settings.addressLine2.trim());
  if (settings.phone?.trim()) details.push(`Tel: ${settings.phone.trim()}`);
  const taxLabel = settings.taxLabel?.trim();
  const taxNumber = settings.taxNumber?.trim();
  if (taxLabel && taxNumber) details.push(`${taxLabel}: ${taxNumber}`);
  else if (taxNumber) details.push(taxNumber);
  for (const raw of details) {
    for (const line of wrapText(sanitizeForEscPos(raw), width)) {
      lines.push(line);
    }
  }
  return lines;
}

function buildFooterEscPos(settings: TicketBusinessSettings | undefined, kind: 'payment' | 'kitchen', width: number): string[] {
  const layout = resolveTicketLayout(settings, kind);
  const lines = [layout.footerLine1, layout.footerLine2, layout.footerLine3]
    .map((line) => line?.trim())
    .filter((s): s is string => Boolean(s));
  if (lines.length === 0) return [];
  const wrapped: string[] = [];
  for (const raw of lines) {
    for (const line of wrapText(sanitizeForEscPos(raw), width)) {
      wrapped.push(line);
    }
  }
  return wrapped;
}

function buildLogoEscPosChunk(
  printer: PrinterProfile | undefined,
  layout: ResolvedTicketLayout,
): Buffer | null {
  let logo: Electron.NativeImage | null = null;

  if (layout.logoType === 'IMAGE' && layout.logoImageDataUrl?.trim()) {
    try {
      const fromData = nativeImage.createFromDataURL(layout.logoImageDataUrl.trim());
      if (fromData && !fromData.isEmpty()) logo = fromData;
    } catch { /* ignore invalid data url, fall back */ }
  }

  if (!logo) logo = getTicketLogoImage();
  if (!logo) return null;

  const paperWidthMm = printer?.paperWidthMm ?? 80;
  const printableWidthDots = paperWidthMm <= 58 ? 384 : 576;
  // logoScale is the logo width as a percentage (0-100) of the printable ticket
  // width: 100 spans the full width, 0 hides the logo. The aspect ratio is
  // always preserved, so the height follows from the (width-limited) ratio and
  // is capped at one full width to keep the header from ballooning.
  const scalePercent = Math.min(100, Math.max(0, layout.logoScale ?? 50)) / 100;
  if (scalePercent <= 0) return null;
  const maxWidthDots = Math.round(printableWidthDots * scalePercent);
  const maxHeightDots = printableWidthDots;
  const sourceSize = logo.getSize();
  const scale = Math.min(maxWidthDots / sourceSize.width, maxHeightDots / sourceSize.height);
  const targetWidth = Math.max(8, Math.floor((sourceSize.width * scale) / 8) * 8);
  const targetHeight = Math.max(8, Math.floor(sourceSize.height * scale));
  const resized = logo.resize({
    width: targetWidth,
    height: targetHeight,
    quality: 'best',
  });
  const bitmap = resized.toBitmap();
  const widthBytes = Math.ceil(targetWidth / 8);
  const raster = Buffer.alloc(widthBytes * targetHeight);

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const pixelOffset = (y * targetWidth + x) * 4;
      const blue = bitmap[pixelOffset];
      const green = bitmap[pixelOffset + 1];
      const red = bitmap[pixelOffset + 2];
      const alpha = bitmap[pixelOffset + 3] / 255;
      const grayscale = (0.299 * red + 0.587 * green + 0.114 * blue) * alpha + 255 * (1 - alpha);

      if (grayscale < 170) {
        const byteIndex = y * widthBytes + Math.floor(x / 8);
        raster[byteIndex] |= 0x80 >> (x % 8);
      }
    }
  }

  const header = Buffer.from([
    0x1d,
    0x76,
    0x30,
    0x00,
    widthBytes & 0xff,
    (widthBytes >> 8) & 0xff,
    targetHeight & 0xff,
    (targetHeight >> 8) & 0xff,
  ]);

  return Buffer.concat([header, raster, feedLines(1)]);
}

function getTicketLogoImage(): Electron.NativeImage | null {
  if (cachedTicketLogo !== undefined) {
    return cachedTicketLogo;
  }

  const logoCandidates = [
    path.join(app.getAppPath(), BUNDLED_LOGO_PATH),
    path.join(process.cwd(), BUNDLED_LOGO_PATH),
  ];

  for (const candidate of logoCandidates) {
    const image = nativeImage.createFromPath(candidate);
    if (!image.isEmpty()) {
      cachedTicketLogo = image;
      return cachedTicketLogo;
    }
  }

  cachedTicketLogo = null;
  return cachedTicketLogo;
}

function escposInit(): Buffer {
  return Buffer.from([0x1b, 0x40, 0x1b, 0x32]);
}

function alignLeft(): Buffer {
  return Buffer.from([0x1b, 0x61, 0x00]);
}

function alignCenter(): Buffer {
  return Buffer.from([0x1b, 0x61, 0x01]);
}

function bold(enabled: boolean): Buffer {
  return Buffer.from([0x1b, 0x45, enabled ? 0x01 : 0x00]);
}

function doubleHeightWidth(enabled: boolean): Buffer {
  return Buffer.from([0x1d, 0x21, enabled ? 0x11 : 0x00]);
}

function openDrawerPulse(): Buffer {
  return Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);
}

function cutPaper(): Buffer {
  return Buffer.from([0x1d, 0x56, 0x42, 0x00]);
}

function feedLines(count: number): Buffer {
  return Buffer.from('\n'.repeat(Math.max(0, count)), 'ascii');
}

function textLine(value: string): Buffer {
  return Buffer.from(`${sanitizeForEscPos(value)}\n`, 'ascii');
}

function sanitizeForEscPos(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePowerShellLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function resolveConfiguredPrinterName(printer: PrinterProfile | undefined): string | undefined {
  return [printer?.systemPrinterName, printer?.queueName, printer?.name].find((value) => Boolean(value));
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

function formatChannelEscPos(order: TicketOrder): string[] {
  const lines: string[] = [];
  const channel =
    order.channel === 'EMPORTER' || order.channel === 'LIVRAISON' || order.channel === 'SUR_PLACE'
      ? order.channel
      : 'SUR_PLACE';

  switch (channel) {
    case 'SUR_PLACE':
      lines.push('CANAL: SUR PLACE');
      if (order.tableNumber) lines.push(`TABLE: ${order.tableNumber}`);
      break;
    case 'EMPORTER':
      lines.push('CANAL: A EMPORTER');
      break;
    case 'LIVRAISON':
      lines.push('CANAL: LIVRAISON');
      if (order.livreurId) lines.push(`LIVREUR: ${order.livreurId}`);
      break;
  }

  if (order.customerPhone) lines.push(`TEL: ${order.customerPhone}`);
  if (order.deliveryAddress) {
    const addr = sanitizeForEscPos(order.deliveryAddress);
    if (addr.length > 38) {
      for (const chunk of wrapText(addr, 38)) {
        lines.push(`ADRESSE: ${chunk}`);
      }
    } else {
      lines.push(`ADRESSE: ${addr}`);
    }
  }
  return lines;
}

async function waitForPrintLayout(printWindow: BrowserWindow): Promise<void> {
  await printWindow.webContents.executeJavaScript(`new Promise(resolve => { requestAnimationFrame(() => { requestAnimationFrame(resolve); }); });`);
  await new Promise((resolve) => setTimeout(resolve, 100));
}

function buildPageSizeMicrons(request: PrintTicketRequest): { width: number; height: number } {
  const widthMm = request.printer?.paperWidthMm ?? 80;
  const heightMm = estimateTicketHeightMm(request);
  return {
    width: widthMm * 1000,
    height: heightMm * 1000,
  };
}

function estimateTicketHeightMm(request: PrintTicketRequest): number {
  const paperWidthMm = request.printer?.paperWidthMm ?? 80;
  const charsPerLine =
    request.printer?.charactersPerLine ?? (paperWidthMm <= 58 ? 28 : 42);
  const reservedChars = request.kind === 'KITCHEN' ? 5 : 12;
  const itemChars = Math.max(12, charsPerLine - reservedChars);
  const wrappedLineCount = request.order.lines.reduce((total, line) => {
    const normalizedLength = line.name.trim().length || 1;
    return total + Math.max(1, Math.ceil(normalizedLength / itemChars));
  }, 0);
  const headerLines = request.kind === 'KITCHEN' ? 4 : 7;
  const footerLines = request.kind === 'KITCHEN' ? 1 : 2;
  const totalTextLines = headerLines + footerLines + wrappedLineCount;
  const heightMm = paperWidthMm <= 58
    ? 10 + totalTextLines * 3.8
    : 12 + totalTextLines * 3.6;

  return Math.max(36, Math.min(160, Math.ceil(heightMm)));
}

function mapWidthToWindowPx(paperWidthMm: number): number {
  return paperWidthMm <= 58 ? 300 : 420;
}

function estimateSalesSummaryHeightMm(request: PrintSalesSummaryRequest): number {
  const paperWidthMm = request.printer?.paperWidthMm ?? 80;
  const headerLines = 11;
  const footerLines = 4;
  const bodyLines = Math.max(2, request.report.entries.length) + 3;
  const totalLines = headerLines + footerLines + bodyLines;
  const heightMm = paperWidthMm <= 58
    ? 22 + totalLines * 4.6
    : 24 + totalLines * 4.2;

  return Math.max(80, Math.min(320, Math.ceil(heightMm)));
}

function buildTicketHtml(request: PrintTicketRequest): string {
  const paperWidthMm = request.printer?.paperWidthMm ?? 80;
  const widthCss = paperWidthMm <= 58 ? '54mm' : '74mm';
  const bodyClass = request.kind === 'KITCHEN' ? 'kitchen' : 'payment';
  const printedAt =
    request.kind === 'KITCHEN'
      ? formatDateTime(request.order.kitchenPrintedAt || request.order.createdAt)
      : formatDateTime(request.order.paidAt || request.order.createdAt);

  const lineRows = request.order.lines
    .map((line) => {
      const amountCell =
        request.kind === 'PAYMENT'
          ? `<td class="price">${formatMoney(line.total, request.order.currency)}</td>`
          : '';

      return `
        <tr>
          <td class="qty">${line.quantity}</td>
          <td class="item">${escapeHtml(line.name)}</td>
          ${amountCell}
        </tr>
      `;
    })
    .join('');

  const vatRows =
    request.kind === 'PAYMENT'
      ? paymentVatRows(request.order)
          .map(
            (row) => `
        <div class="summary-row meta-row">
          <span>${escapeHtml(row.label)}</span>
          <span>${escapeHtml(row.value)}</span>
        </div>
      `,
          )
          .join('')
      : '';

  const totalBlock =
    request.kind === 'PAYMENT'
      ? `
        <div class="divider"></div>
        <div class="summary-row">
          <span>Total TTC</span>
          <strong>${formatMoney(request.order.total, request.order.currency)}</strong>
        </div>
        ${vatRows}
        <div class="summary-row meta-row">
          <span>Paiement</span>
          <span>${formatPaymentMethod(request.order.paymentMethod)}</span>
        </div>
      `
      : `
        <div class="divider"></div>
        <div class="summary-row meta-row">
          <span>Lignes</span>
          <span>${request.order.lineCount}</span>
        </div>
      `;

  const totalHeader = request.kind === 'PAYMENT' ? '<th class="price">Prix</th>' : '';

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${request.kind === 'KITCHEN' ? 'Ticket Cuisine' : 'Ticket Paiement'}</title>
        <style>
          @page {
            size: ${paperWidthMm}mm ${estimateTicketHeightMm(request)}mm;
            margin: 0;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff;
            color: #111111;
            font-family: "SF Mono", "Menlo", "Consolas", monospace;
            width: ${widthCss};
            min-height: 0;
            height: auto;
          }

          body {
            display: flex;
            align-items: flex-start;
            justify-content: flex-start;
            padding: 0;
            font-size: ${request.kind === 'KITCHEN' ? '11px' : '10px'};
            line-height: 1.2;
            overflow: hidden;
          }

          .ticket-root {
            width: ${widthCss};
            box-sizing: border-box;
            margin: 0;
            padding: 0.6mm 2mm 2mm;
          }

          .header {
            text-align: center;
            margin-bottom: 4px;
          }

          .header h1 {
            margin: 0 0 1px;
            font-size: ${request.kind === 'KITCHEN' ? '15px' : '14px'};
            letter-spacing: 0.02em;
            text-transform: uppercase;
          }

          .meta {
            display: grid;
            gap: 1px;
            font-size: 9px;
          }

          .divider {
            border-top: 1px dashed #222222;
            margin: 4px 0;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          th, td {
            padding: 1px 0;
            vertical-align: top;
          }

          thead th {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
          }

          .qty {
            width: 10mm;
          }

          .item {
            width: auto;
            padding-right: 4px;
            word-break: break-word;
          }

          .price {
            width: ${request.kind === 'PAYMENT' ? '18mm' : '0'};
            text-align: right;
          }

          .summary-row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            margin: 1px 0;
          }

          .summary-row strong {
            font-size: 11px;
          }

          .meta-row {
            font-size: 9px;
            color: #333333;
          }
        </style>
      </head>
      <body class="${bodyClass}">
        <div class="ticket-root">
          <div class="header">
            <h1>${request.kind === 'KITCHEN' ? 'Ticket Cuisine' : 'Ticket Paiement'}</h1>
            <div class="meta">
              <div>${escapeHtml(request.order.orderNumber)}</div>
              <div>${request.kind === 'KITCHEN' ? 'Prepare' : 'Paye'} ${escapeHtml(printedAt)}</div>
            </div>
          </div>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th class="qty">Qte</th>
                <th class="item">Article</th>
                ${totalHeader}
              </tr>
            </thead>
            <tbody>
              ${lineRows}
            </tbody>
          </table>
          ${totalBlock}
        </div>
      </body>
    </html>
  `;
}

function buildSalesSummaryHtml(request: PrintSalesSummaryRequest): string {
  const paperWidthMm = request.printer?.paperWidthMm ?? 80;
  const widthCss = paperWidthMm <= 58 ? '54mm' : '74mm';
  const lineRows = request.report.entries.length > 0
    ? request.report.entries
        .map((entry) => `
          <tr>
            <td class="time">${escapeHtml(formatTime(entry.paidAt))}</td>
            <td class="item">${escapeHtml(entry.orderNumber)}</td>
            <td class="price">${formatMoney(entry.total, entry.currency)}</td>
          </tr>
        `)
        .join('')
    : `
      <tr>
        <td class="time">--:--</td>
        <td class="item">Aucune commande payee</td>
        <td class="price">${formatMoney(0, request.report.currency)}</td>
      </tr>
    `;

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Total Journalier</title>
        <style>
          @page {
            size: ${paperWidthMm}mm ${estimateSalesSummaryHeightMm(request)}mm;
            margin: 0;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff;
            color: #111111;
            font-family: "SF Mono", "Menlo", "Consolas", monospace;
            width: ${widthCss};
            min-height: 0;
            height: auto;
          }

          body {
            display: flex;
            align-items: flex-start;
            justify-content: flex-start;
            padding: 0;
            font-size: 10px;
            line-height: 1.2;
            overflow: hidden;
          }

          .ticket-root {
            width: ${widthCss};
            box-sizing: border-box;
            margin: 0;
            padding: 0.6mm 2mm 2mm;
          }

          .header {
            text-align: center;
            margin-bottom: 8px;
          }

          .header h1 {
            margin: 0 0 3px;
            font-size: 16px;
            text-transform: uppercase;
          }

          .meta {
            display: grid;
            gap: 2px;
          }

          .divider {
            border-top: 1px dashed #222222;
            margin: 6px 0;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          th, td {
            padding: 2px 0;
            vertical-align: top;
          }

          thead th {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
          }

          .time {
            width: 14mm;
          }

          .item {
            width: auto;
            padding-right: 4px;
            word-break: break-word;
          }

          .price {
            width: 20mm;
            text-align: right;
          }

          .summary-row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            margin: 2px 0;
          }

          .summary-row strong {
            font-size: 12px;
          }

          .meta-row {
            font-size: 9px;
            color: #333333;
          }

          .footer {
            margin-top: 6px;
            text-align: center;
            font-size: 9px;
          }
        </style>
      </head>
      <body>
        <div class="ticket-root">
          <div class="header">
            <h1>Total Journalier</h1>
            <div class="meta">
              <div>Succursale ${escapeHtml(request.report.branchName)}</div>
              <div>${request.report.range === 'DAY_START' ? 'Depuis debut de journee' : 'Depuis dernier total imprime'}</div>
              <div>Periode ${escapeHtml(formatDateTime(request.report.fromAt))} -> ${escapeHtml(formatDateTime(request.report.toAt))}</div>
              <div>Imprime ${escapeHtml(formatDateTime(request.report.generatedAt))}</div>
            </div>
          </div>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th class="time">Heure</th>
                <th class="item">Commande</th>
                <th class="price">Montant</th>
              </tr>
            </thead>
            <tbody>
              ${lineRows}
            </tbody>
          </table>
          <div class="divider"></div>
          <div class="summary-row">
            <span>Total commandes</span>
            <strong>${request.report.orderCount}</strong>
          </div>
          <div class="summary-row">
            <span>Total cumule</span>
            <strong>${formatMoney(request.report.grandTotal, request.report.currency)}</strong>
          </div>
        </div>
      </body>
    </html>
  `;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(value: number, currency: string): string {
  return `${value.toFixed(2)} ${currency}`;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPaymentMethod(paymentMethod: string): string {
  if (paymentMethod === 'CARD') {
    return 'Carte';
  }
  if (paymentMethod === 'CASH') {
    return 'Especes';
  }
  return 'Non paye';
}

function formatVatRate(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

function summaryChannelLabel(channel: 'SUR_PLACE' | 'EMPORTER' | 'LIVRAISON'): string {
  if (channel === 'EMPORTER') {
    return 'A EMPORTER';
  }
  if (channel === 'LIVRAISON') {
    return 'LIVRAISON';
  }
  return 'SUR PLACE';
}

/**
 * VAT breakdown rows for the payment ticket. Prices are VAT-inclusive, so the
 * total stays the amount actually paid and the VAT is shown as extracted from
 * it (TTC -> TVA -> HT). Returns an empty list when the order carries no VAT
 * detail (e.g. orders recorded before VAT support).
 */
function paymentVatRows(order: TicketOrder): { label: string; value: string }[] {
  if (
    typeof order.vatRate !== 'number' ||
    typeof order.vatAmount !== 'number' ||
    typeof order.netTotal !== 'number'
  ) {
    return [];
  }
  return [
    { label: `TVA ${formatVatRate(order.vatRate)}`, value: formatMoney(order.vatAmount, order.currency) },
    { label: 'TOTAL HT', value: formatMoney(order.netTotal, order.currency) },
  ];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

app.whenReady().then(() => {
  registerDesktopApi();
  registerPocketApi();
  registerPosWsApi();
  mainWindow = createMainWindow();

  // The WebSocket client round-trips to the renderer for catalog/orders, so it
  // only starts once the renderer is loaded.
  mainWindow.webContents.once('did-finish-load', () => {
    void ensurePosWsClient().then((client) => client.start());
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });

  // Waking from sleep and resolution/DPI changes both reset the renderer zoom.
  powerMonitor.on('resume', () => {
    if (mainWindow) {
      applyDisplayScale(mainWindow);
    }
  });
  screen.on('display-metrics-changed', () => {
    if (mainWindow) {
      applyDisplayScale(mainWindow);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  void pocketServer?.stop();
  posWsClient?.stop();
});
