import { createHash, randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { connect as netConnect, type Socket } from 'node:net';
import { connect as tlsConnect } from 'node:tls';

/**
 * Minimal RFC 6455 WebSocket client used by the POS integration.
 *
 * The app ships an old Electron/Node runtime without a global `WebSocket`, and
 * no third-party WebSocket package is bundled, so the transport is implemented
 * here on top of `node:tls` / `node:net`. It supports exactly what the POS
 * protocol needs: outbound text frames, fragmentation, ping/pong and close.
 */

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const DEFAULT_HANDSHAKE_TIMEOUT_MS = 15000;
const DEFAULT_MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;

const OPCODE_CONTINUATION = 0x0;
const OPCODE_TEXT = 0x1;
const OPCODE_BINARY = 0x2;
const OPCODE_CLOSE = 0x8;
const OPCODE_PING = 0x9;
const OPCODE_PONG = 0xa;

export interface WsTransportOptions {
  url: string;
  headers?: Record<string, string>;
  handshakeTimeoutMs?: number;
  maxPayloadBytes?: number;
}

export interface WsCloseInfo {
  code: number;
  reason: string;
}

interface WsTarget {
  secure: boolean;
  host: string;
  port: number;
  path: string;
  hostHeader: string;
}

export class WsTransport extends EventEmitter {
  private socket: Socket | null = null;
  private pending: Buffer = Buffer.alloc(0);
  private fragments: Buffer[] = [];
  private fragmentOpcode = 0;
  private state: 'closed' | 'connecting' | 'open' = 'closed';
  private handshakeComplete = false;
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null;
  private closeEmitted = false;
  private readonly maxPayload: number;

  constructor(private readonly options: WsTransportOptions) {
    super();
    this.maxPayload = options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES;
  }

  isOpen(): boolean {
    return this.state === 'open';
  }

  open(): void {
    if (this.state !== 'closed') {
      return;
    }
    this.state = 'connecting';
    this.closeEmitted = false;

    let target: WsTarget;
    try {
      target = parseTarget(this.options.url);
    } catch (error) {
      this.state = 'closed';
      this.emitError(error instanceof Error ? error : new Error('Invalid WebSocket URL'));
      return;
    }

    const key = randomBytes(16).toString('base64');
    const socket = target.secure
      ? tlsConnect({ host: target.host, port: target.port, servername: target.host })
      : netConnect({ host: target.host, port: target.port });

    this.socket = socket;
    socket.setNoDelay(true);

    const startHandshake = (): void => {
      if (this.state !== 'connecting') {
        return;
      }
      const lines = [
        `GET ${target.path} HTTP/1.1`,
        `Host: ${target.hostHeader}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
      ];
      for (const [name, value] of Object.entries(this.options.headers ?? {})) {
        lines.push(`${name}: ${value}`);
      }
      socket.write(`${lines.join('\r\n')}\r\n\r\n`);
    };

    socket.on(target.secure ? 'secureConnect' : 'connect', startHandshake);
    socket.on('data', (chunk: Buffer) => this.handleData(chunk, key));
    socket.on('error', (error: Error) => this.fail(error));
    socket.on('close', () => this.finalizeClose(1006, 'socket closed'));

    this.handshakeTimer = setTimeout(
      () => this.fail(new Error('WebSocket handshake timeout')),
      this.options.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS,
    );
  }

  send(text: string): boolean {
    if (this.state !== 'open' || !this.socket) {
      return false;
    }
    const payload = Buffer.from(text, 'utf8');
    this.socket.write(encodeFrame(OPCODE_TEXT, payload));
    return true;
  }

  close(code = 1000, reason = 'client closed'): void {
    if (this.socket && this.state === 'open') {
      const payload = Buffer.alloc(2 + Buffer.byteLength(reason, 'utf8'));
      payload.writeUInt16BE(code, 0);
      payload.write(reason, 2, 'utf8');
      try {
        this.socket.write(encodeFrame(OPCODE_CLOSE, payload));
      } catch {
        // socket already gone
      }
    }
    this.teardown();
    this.finalizeClose(code, reason);
  }

  private handleData(chunk: Buffer, key: string): void {
    this.pending = this.pending.length === 0 ? chunk : Buffer.concat([this.pending, chunk]);

    if (!this.handshakeComplete) {
      const separator = this.pending.indexOf('\r\n\r\n');
      if (separator === -1) {
        if (this.pending.length > 64 * 1024) {
          this.fail(new Error('WebSocket handshake response too large'));
        }
        return;
      }
      const headerText = this.pending.subarray(0, separator).toString('latin1');
      this.pending = this.pending.subarray(separator + 4);
      if (!this.validateHandshake(headerText, key)) {
        return;
      }
      this.handshakeComplete = true;
      this.state = 'open';
      this.clearHandshakeTimer();
      this.emit('open');
    }

    try {
      this.drainFrames();
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error('WebSocket frame error'));
    }
  }

  private validateHandshake(headerText: string, key: string): boolean {
    const lines = headerText.split('\r\n');
    const statusLine = lines[0] ?? '';
    const match = /^HTTP\/1\.[01]\s+(\d{3})/.exec(statusLine);
    const status = match ? Number(match[1]) : 0;
    if (status !== 101) {
      this.fail(new Error(`WebSocket upgrade rejected with status ${status || 'unknown'}`));
      return false;
    }

    const headers = new Map<string, string>();
    for (const line of lines.slice(1)) {
      const index = line.indexOf(':');
      if (index === -1) {
        continue;
      }
      headers.set(line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim());
    }

    const expected = createHash('sha1')
      .update(`${key}${WS_GUID}`)
      .digest('base64');
    if (headers.get('sec-websocket-accept') !== expected) {
      this.fail(new Error('WebSocket handshake accept mismatch'));
      return false;
    }
    return true;
  }

  private drainFrames(): void {
    while (this.pending.length >= 2) {
      const first = this.pending[0];
      const second = this.pending[1];
      const fin = (first & 0x80) !== 0;
      const opcode = first & 0x0f;
      const masked = (second & 0x80) !== 0;
      let length = second & 0x7f;
      let offset = 2;

      if (length === 126) {
        if (this.pending.length < 4) return;
        length = this.pending.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (this.pending.length < 10) return;
        const big = this.pending.readBigUInt64BE(2);
        if (big > BigInt(this.maxPayload)) {
          throw new Error('WebSocket frame exceeds maximum payload size');
        }
        length = Number(big);
        offset = 10;
      }

      if (length > this.maxPayload) {
        throw new Error('WebSocket frame exceeds maximum payload size');
      }

      let maskKey: Buffer | null = null;
      if (masked) {
        if (this.pending.length < offset + 4) return;
        maskKey = this.pending.subarray(offset, offset + 4);
        offset += 4;
      }

      if (this.pending.length < offset + length) {
        return;
      }

      let payload: Buffer = this.pending.subarray(offset, offset + length);
      if (maskKey) {
        payload = applyMask(payload, maskKey);
      }
      this.pending = this.pending.subarray(offset + length);
      this.handleFrame(opcode, fin, payload);
    }
  }

  private handleFrame(opcode: number, fin: boolean, payload: Buffer): void {
    switch (opcode) {
      case OPCODE_PING:
        this.writeControl(OPCODE_PONG, payload);
        return;
      case OPCODE_PONG:
        this.emit('pong', payload);
        return;
      case OPCODE_CLOSE: {
        const code = payload.length >= 2 ? payload.readUInt16BE(0) : 1005;
        const reason = payload.length > 2 ? payload.subarray(2).toString('utf8') : '';
        this.writeControl(OPCODE_CLOSE, payload.subarray(0, Math.min(payload.length, 2)));
        this.teardown();
        this.finalizeClose(code, reason);
        return;
      }
      case OPCODE_TEXT:
      case OPCODE_BINARY:
        if (fin) {
          this.deliver(opcode, payload);
          return;
        }
        this.fragmentOpcode = opcode;
        this.fragments = [payload];
        return;
      case OPCODE_CONTINUATION: {
        this.fragments.push(payload);
        const total = this.fragments.reduce((sum, part) => sum + part.length, 0);
        if (total > this.maxPayload) {
          throw new Error('WebSocket message exceeds maximum payload size');
        }
        if (fin) {
          const message = Buffer.concat(this.fragments);
          const opcodeOfMessage = this.fragmentOpcode;
          this.fragments = [];
          this.fragmentOpcode = 0;
          this.deliver(opcodeOfMessage, message);
        }
        return;
      }
      default:
        return;
    }
  }

  private deliver(opcode: number, payload: Buffer): void {
    if (opcode !== OPCODE_TEXT) {
      return;
    }
    this.emit('message', payload.toString('utf8'));
  }

  private writeControl(opcode: number, payload: Buffer): void {
    if (!this.socket || this.state === 'closed') {
      return;
    }
    try {
      this.socket.write(encodeFrame(opcode, payload));
    } catch {
      // socket already gone
    }
  }

  private fail(error: Error): void {
    this.emitError(error);
    this.teardown();
    this.finalizeClose(1006, error.message);
  }

  private emitError(error: Error): void {
    this.emit('error', error);
  }

  private finalizeClose(code: number, reason: string): void {
    this.clearHandshakeTimer();
    if (this.closeEmitted) {
      return;
    }
    this.closeEmitted = true;
    this.state = 'closed';
    const info: WsCloseInfo = { code, reason };
    this.emit('close', info);
  }

  private teardown(): void {
    this.clearHandshakeTimer();
    const socket = this.socket;
    this.socket = null;
    this.state = 'closed';
    this.pending = Buffer.alloc(0);
    this.fragments = [];
    this.fragmentOpcode = 0;
    if (socket) {
      socket.removeAllListeners();
      socket.destroy();
    }
  }

  private clearHandshakeTimer(): void {
    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }
  }
}

function parseTarget(rawUrl: string): WsTarget {
  const url = new URL(rawUrl);
  const secure = url.protocol === 'wss:';
  if (!secure && url.protocol !== 'ws:') {
    throw new Error(`Unsupported WebSocket protocol: ${url.protocol}`);
  }
  const port = url.port ? Number(url.port) : secure ? 443 : 80;
  return {
    secure,
    host: url.hostname,
    port,
    path: `${url.pathname || '/'}${url.search}`,
    hostHeader: url.port ? `${url.hostname}:${url.port}` : url.hostname,
  };
}

function encodeFrame(opcode: number, payload: Buffer): Buffer {
  const length = payload.length;
  let header: Buffer;

  if (length < 126) {
    header = Buffer.alloc(6);
    header[1] = 0x80 | length;
  } else if (length < 65536) {
    header = Buffer.alloc(8);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(14);
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  header[0] = 0x80 | opcode;
  const maskKey = randomBytes(4);
  const maskOffset = header.length - 4;
  maskKey.copy(header, maskOffset);
  return Buffer.concat([header, applyMask(payload, maskKey)]);
}

function applyMask(payload: Buffer, maskKey: Buffer): Buffer {
  const output = Buffer.allocUnsafe(payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    output[index] = payload[index] ^ maskKey[index % 4];
  }
  return output;
}
