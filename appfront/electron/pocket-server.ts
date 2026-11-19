import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import QRCode from 'qrcode';

export interface PocketCategory {
  id: string;
  name: string;
  description?: string;
}

export interface PocketProduct {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  currency: string;
  sku: string;
  available: boolean;
}

export interface PocketTable {
  id: string;
  number: string;
  zone?: string;
  status?: string;
}

export interface PocketDriver {
  id: string;
  number?: string;
  name?: string;
  status?: string;
}

export interface PocketCatalogPayload {
  businessName: string;
  currency: string;
  categories: PocketCategory[];
  products: PocketProduct[];
  tables: PocketTable[];
  drivers: PocketDriver[];
}

export interface PocketOrderLine {
  productId: string;
  quantity: number;
}

export interface PocketOrderRequest {
  channel: 'SUR_PLACE' | 'EMPORTER' | 'LIVRAISON';
  tableNumber?: string;
  livreurId?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  note?: string;
  lines: PocketOrderLine[];
}

export interface PocketOrderResult {
  ok: boolean;
  orderId?: string;
  orderNumber?: string;
  total?: number;
  error?: string;
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

export interface PocketServerOptions {
  staticDir: string;
  handleOrder: (order: PocketOrderRequest, meta: { requestId: string; deviceLabel: string }) => Promise<PocketOrderResult>;
  onStatusChange?: (status: PocketServerStatus) => void;
}

const DEFAULT_PORT = 8787;
const ORDER_TIMEOUT_MS = 15000;

interface DeviceSession {
  id: string;
  label: string;
  lastSeenAt: number;
  orderCount: number;
}

const STATIC_MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

export class PocketServer {
  private server: Server | null = null;
  private port: number | null = null;
  private pin = '';
  private qrDataUrl: string | null = null;
  private readonly sessions = new Map<string, DeviceSession>();
  private catalog: PocketCatalogPayload | null = null;

  constructor(private readonly options: PocketServerOptions) {}

  setCatalog(catalog: PocketCatalogPayload): void {
    this.catalog = catalog;
  }

  isRunning(): boolean {
    return this.server !== null;
  }

  async start(preferredPort = DEFAULT_PORT): Promise<PocketServerStatus> {
    if (this.server) {
      return this.status();
    }

    this.pin = this.generatePin();
    const server = createServer((request, response) => {
      this.handleRequest(request, response).catch((error: unknown) => {
        this.sendJson(response, 500, { error: error instanceof Error ? error.message : 'Server error' });
      });
    });

    const port = await this.listen(server, preferredPort);
    this.server = server;
    this.port = port;
    this.qrDataUrl = await this.buildQrDataUrl();
    this.emitStatus();
    return this.status();
  }

  async stop(): Promise<PocketServerStatus> {
    const server = this.server;
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      this.server = null;
      this.port = null;
      this.pin = '';
      this.qrDataUrl = null;
      this.sessions.clear();
    }
    this.emitStatus();
    return this.status();
  }

  regeneratePin(): PocketServerStatus {
    this.pin = this.generatePin();
    this.sessions.clear();
    this.emitStatus();
    return this.status();
  }

  status(): PocketServerStatus {
    const address = getLanAddress();
    return {
      running: this.isRunning(),
      url: this.isRunning() && address && this.port ? `http://${address}:${this.port}` : null,
      address,
      port: this.port,
      pin: this.isRunning() ? this.pin : null,
      qrDataUrl: this.isRunning() ? this.qrDataUrl : null,
      devices: [...this.sessions.values()]
        .sort((left, right) => right.lastSeenAt - left.lastSeenAt)
        .map((session) => ({
          id: session.id,
          label: session.label,
          lastSeenAt: new Date(session.lastSeenAt).toISOString(),
          orderCount: session.orderCount,
        })),
    };
  }

  private async listen(server: Server, preferredPort: number): Promise<number> {
    for (let offset = 0; offset < 12; offset += 1) {
      const port = preferredPort + offset;
      const bound = await tryListen(server, port);
      if (bound) {
        return port;
      }
    }
    throw new Error(`Aucun port disponible autour de ${preferredPort}.`);
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    setCors(response);

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? '/', 'http://localhost');
    const route = url.pathname;

    if (route === '/api/info') {
      this.sendJson(response, 200, {
        ok: true,
        businessName: this.catalog?.businessName ?? '',
        requiresPairing: true,
      });
      return;
    }

    if (route === '/api/pair' && request.method === 'POST') {
      await this.handlePair(request, response);
      return;
    }

    if (route.startsWith('/api/')) {
      const session = this.authorize(request);
      if (!session) {
        this.sendJson(response, 401, { error: 'unauthorized' });
        return;
      }
      session.lastSeenAt = Date.now();
      this.emitStatus();

      if (route === '/api/catalog' && request.method === 'GET') {
        this.sendJson(response, 200, this.catalog ?? emptyCatalog());
        return;
      }

      if (route === '/api/orders' && request.method === 'POST') {
        await this.handleOrder(request, response, session);
        return;
      }

      this.sendJson(response, 404, { error: 'not_found' });
      return;
    }

    await this.serveStatic(response, route);
  }

  private async handlePair(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = await readJsonBody(request);
    const pin = typeof body?.['pin'] === 'string' ? body['pin'].trim() : '';
    if (!pin || pin !== this.pin) {
      this.sendJson(response, 401, { error: 'invalid_pin' });
      return;
    }

    const token = randomBytes(24).toString('hex');
    const id = randomBytes(6).toString('hex');
    const rawLabel = typeof body?.['label'] === 'string' ? body['label'].trim() : '';
    const session: DeviceSession = {
      id,
      label: rawLabel || `Appareil ${id.slice(0, 4).toUpperCase()}`,
      lastSeenAt: Date.now(),
      orderCount: 0,
    };
    this.sessions.set(token, session);
    this.emitStatus();

    this.sendJson(response, 200, {
      token,
      deviceId: id,
      businessName: this.catalog?.businessName ?? '',
    });
  }

  private async handleOrder(
    request: IncomingMessage,
    response: ServerResponse,
    session: DeviceSession,
  ): Promise<void> {
    const body = await readJsonBody(request);
    const validation = validateOrder(body);
    if (!validation.ok) {
      this.sendJson(response, 400, { error: validation.error });
      return;
    }

    const requestId = randomBytes(8).toString('hex');
    let result: PocketOrderResult;
    try {
      result = await withTimeout(
        this.options.handleOrder(validation.order, { requestId, deviceLabel: session.label }),
        ORDER_TIMEOUT_MS,
        { ok: false, error: 'La caisse n a pas repondu a temps.' },
      );
    } catch (error) {
      result = { ok: false, error: error instanceof Error ? error.message : 'Erreur inconnue' };
    }

    if (result.ok) {
      session.orderCount += 1;
      session.lastSeenAt = Date.now();
      this.emitStatus();
    }

    this.sendJson(response, result.ok ? 200 : 400, result);
  }

  private authorize(request: IncomingMessage): DeviceSession | null {
    const header = request.headers['authorization'];
    const token = typeof header === 'string' && header.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : '';
    if (!token) {
      return null;
    }
    return this.sessions.get(token) ?? null;
  }

  private async serveStatic(response: ServerResponse, route: string): Promise<void> {
    const relative = route === '/' ? 'index.html' : route.replace(/^\/+/, '');
    const normalized = path.normalize(relative);
    if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
      this.sendJson(response, 400, { error: 'bad_path' });
      return;
    }

    const filePath = path.join(this.options.staticDir, normalized);
    const extension = path.extname(filePath).toLowerCase();
    const contentType = STATIC_MIME[extension];
    if (!contentType) {
      this.sendJson(response, 404, { error: 'not_found' });
      return;
    }

    try {
      const content = await readFile(filePath);
      response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
      response.end(content);
    } catch {
      this.sendJson(response, 404, { error: 'not_found' });
    }
  }

  private sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
    if (response.writableEnded) {
      return;
    }
    const body = JSON.stringify(payload);
    response.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
    });
    response.end(body);
  }

  private generatePin(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private async buildQrDataUrl(): Promise<string | null> {
    const address = getLanAddress();
    if (!address || !this.port) {
      return null;
    }
    try {
      return await QRCode.toDataURL(`http://${address}:${this.port}`, { margin: 1, width: 320 });
    } catch {
      return null;
    }
  }

  private emitStatus(): void {
    this.options.onStatusChange?.(this.status());
  }
}

function tryListen(server: Server, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const onError = (): void => {
      server.removeListener('listening', onListening);
      resolve(false);
    };
    const onListening = (): void => {
      server.removeListener('error', onError);
      resolve(true);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '0.0.0.0');
  });
}

function getLanAddress(): string | null {
  const interfaces = os.networkInterfaces();
  const candidates: string[] = [];
  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) {
        continue;
      }
      candidates.push(address.address);
    }
  }
  return (
    candidates.find((value) => value.startsWith('192.168.')) ??
    candidates.find((value) => value.startsWith('10.')) ??
    candidates.find((value) => /^172\.(1[6-9]|2\d|3[01])\./.test(value)) ??
    candidates[0] ??
    null
  );
}

function emptyCatalog(): PocketCatalogPayload {
  return { businessName: '', currency: '', categories: [], products: [], tables: [], drivers: [] };
}

function setCors(response: ServerResponse): void {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1_000_000) {
        resolve(null);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (chunks.length === 0) {
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null);
      } catch {
        resolve(null);
      }
    });
    request.on('error', () => resolve(null));
  });
}

function validateOrder(
  body: Record<string, unknown> | null,
): { ok: true; order: PocketOrderRequest } | { ok: false; error: string } {
  if (!body) {
    return { ok: false, error: 'Corps de requete invalide.' };
  }

  const channel = body['channel'];
  if (channel !== 'SUR_PLACE' && channel !== 'EMPORTER' && channel !== 'LIVRAISON') {
    return { ok: false, error: 'Type de commande invalide.' };
  }

  const rawLines = Array.isArray(body['lines']) ? body['lines'] : [];
  const lines: PocketOrderLine[] = [];
  for (const entry of rawLines) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const productId = typeof record['productId'] === 'string' ? record['productId'] : '';
    const quantity = Number(record['quantity']);
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) continue;
    lines.push({ productId, quantity: Math.floor(quantity) });
  }

  if (lines.length === 0) {
    return { ok: false, error: 'La commande est vide.' };
  }

  const asOptionalString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;

  return {
    ok: true,
    order: {
      channel,
      lines,
      tableNumber: asOptionalString(body['tableNumber']),
      livreurId: asOptionalString(body['livreurId']),
      customerPhone: asOptionalString(body['customerPhone']),
      deliveryAddress: asOptionalString(body['deliveryAddress']),
      note: asOptionalString(body['note']),
    },
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}
