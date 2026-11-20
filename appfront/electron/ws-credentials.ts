import { app, safeStorage } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_POS_WS_URL } from './pos-ws-client';

/**
 * Durable, encrypted storage for the almani-nafris.com integration settings.
 * The bearer token is encrypted with the OS keychain through Electron's
 * `safeStorage`; only ciphertext is written to disk.
 */

export interface PosWsStoredConfig {
  enabled: boolean;
  url: string;
  branchId: string | null;
  deviceId: string | null;
  tenantId: string | null;
  token: string;
}

export const DEFAULT_POS_WS_CONFIG: PosWsStoredConfig = {
  enabled: false,
  url: DEFAULT_POS_WS_URL,
  branchId: null,
  deviceId: null,
  tenantId: null,
  token: '',
};

interface PersistedShape extends Omit<PosWsStoredConfig, 'token'> {
  token: string;
  tokenEncrypted: boolean;
}

function configPath(): string {
  return path.join(app.getPath('userData'), 'pos-integration.json');
}

export async function loadPosWsConfig(): Promise<PosWsStoredConfig> {
  try {
    const raw = await readFile(configPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedShape>;
    return {
      enabled: Boolean(parsed.enabled),
      url: typeof parsed.url === 'string' && parsed.url.trim() ? parsed.url.trim() : DEFAULT_POS_WS_URL,
      branchId: typeof parsed.branchId === 'string' ? parsed.branchId : null,
      deviceId: typeof parsed.deviceId === 'string' ? parsed.deviceId : null,
      tenantId: typeof parsed.tenantId === 'string' ? parsed.tenantId : null,
      token: decryptToken(parsed.token ?? '', parsed.tokenEncrypted !== false),
    };
  } catch {
    return { ...DEFAULT_POS_WS_CONFIG };
  }
}

export async function savePosWsConfig(config: PosWsStoredConfig): Promise<PosWsStoredConfig> {
  const encrypted = encryptToken(config.token);
  const shape: PersistedShape = {
    enabled: config.enabled,
    url: config.url,
    branchId: config.branchId,
    deviceId: config.deviceId,
    tenantId: config.tenantId,
    token: encrypted.value,
    tokenEncrypted: encrypted.encrypted,
  };
  await mkdir(path.dirname(configPath()), { recursive: true });
  await writeFile(configPath(), JSON.stringify(shape, null, 2), { encoding: 'utf8', mode: 0o600 });
  return config;
}

function encryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function encryptToken(token: string): { value: string; encrypted: boolean } {
  if (!token) {
    return { value: '', encrypted: true };
  }
  if (!encryptionAvailable()) {
    return { value: token, encrypted: false };
  }
  try {
    return { value: safeStorage.encryptString(token).toString('base64'), encrypted: true };
  } catch {
    return { value: token, encrypted: false };
  }
}

function decryptToken(value: string, encrypted: boolean): string {
  if (!value) {
    return '';
  }
  if (!encrypted) {
    return value;
  }
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
  } catch {
    return '';
  }
}
