import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { execFile } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

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

interface TicketLine {
  name: string;
  quantity: number;
  total: number;
}

interface TicketOrder {
  orderNumber: string;
  cashierName: string;
  total: number;
  currency: string;
  paymentMethod: string;
  status: string;
  lineCount: number;
  lines: TicketLine[];
  createdAt: string;
  kitchenPrintedAt?: string;
  paidAt?: string;
}

interface PrintTicketRequest {
  kind: TicketKind;
  printer?: PrinterProfile;
  order: TicketOrder;
}

interface SalesSummaryEntry {
  orderId: string;
  orderNumber: string;
  paidAt: string;
  total: number;
  currency: string;
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
  currency: string;
  entries: SalesSummaryEntry[];
}

interface PrintSalesSummaryRequest {
  printer?: PrinterProfile;
  report: SalesSummaryReport;
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

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1520,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#0b0f12',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const rendererUrl = process.env['NOVAPOS_RENDERER_URL'];
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

function registerDesktopApi(): void {
  ipcMain.handle('novapos:desktop-info', async () => ({
    isDesktop: true,
    platform: process.platform,
    version: app.getVersion(),
    packaged: app.isPackaged,
  }));

  ipcMain.handle('novapos:list-printers', async () => {
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

  ipcMain.handle('novapos:print-ticket', async (_event, request: PrintTicketRequest) =>
    printTicket(request),
  );
  ipcMain.handle('novapos:print-sales-summary', async (_event, request: PrintSalesSummaryRequest) =>
    printSalesSummary(request),
  );
}

async function printTicket(request: PrintTicketRequest): Promise<{
  success: boolean;
  message: string;
  printerName?: string;
}> {
  const printWindow = new BrowserWindow({ show: false, width: mapWidthToWindowPx(request.printer?.paperWidthMm ?? 80), height: 900, backgroundColor: '#ffffff', webPreferences: { sandbox: true } });
  const html = buildTicketHtml(request);
  await printWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);
  await waitForPrintLayout(printWindow);
  const deviceName = request.printer?.systemPrinterName || request.printer?.name || request.printer?.queueName || undefined;
  const pageSize = buildPageSizeMicrons(request);
  try {
    const result = await new Promise<{ success: boolean; failureReason?: string }>((resolve) => printWindow.webContents.print({ silent: request.printer?.silent ?? true, printBackground: true, deviceName, preferCSSPageSize: true, margins: { marginType: 'none' }, pageSize } as PrintOptionsWithCssPageSize, (success: boolean, failureReason: string) => resolve({ success, failureReason })));
    return { success: result.success, message: result.success ? 'Printed successfully.' : result.failureReason || 'Desktop printing failed.', printerName: deviceName };
  } finally {
    printWindow.close();
  }
}

async function printSalesSummary(request: PrintSalesSummaryRequest): Promise<{
  success: boolean;
  message: string;
  printerName?: string;
}> {
  const printWindow = new BrowserWindow({ show: false, width: mapWidthToWindowPx(request.printer?.paperWidthMm ?? 80), height: 1100, backgroundColor: '#ffffff', webPreferences: { sandbox: true } });
  const html = buildSalesSummaryHtml(request);
  await printWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);
  await waitForPrintLayout(printWindow);
  const deviceName = request.printer?.systemPrinterName || request.printer?.name || request.printer?.queueName || undefined;
  const pageSize = { width: (request.printer?.paperWidthMm ?? 80) * 1000, height: estimateSalesSummaryHeightMm(request) * 1000 };
  try {
    const result = await new Promise<{ success: boolean; failureReason?: string }>((resolve) => printWindow.webContents.print({ silent: request.printer?.silent ?? true, printBackground: true, deviceName, preferCSSPageSize: true, margins: { marginType: 'none' }, pageSize } as PrintOptionsWithCssPageSize, (success: boolean, failureReason: string) => resolve({ success, failureReason })));
    return { success: result.success, message: result.success ? 'Printed successfully.' : result.failureReason || 'Desktop summary printing failed.', printerName: deviceName };
  } finally {
    printWindow.close();
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
        socket.end(payload);
      },
    );

    socket.setTimeout(5000);
    socket.on('timeout', () => {
      socket.destroy(new Error(`Timed out while connecting to ${destination.host}:${destination.port}.`));
    });
    socket.on('error', (error) => reject(error));
    socket.on('close', (hadError) => {
      if (!hadError) {
        resolve();
      }
    });
  });
}

async function sendToSystemPrinterQueue(
  destination: Extract<RawPrinterDestination, { type: 'queue' }>,
  payload: Buffer,
): Promise<void> {
  const tempFilePath = path.join(
    os.tmpdir(),
    `novapos-escpos-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`,
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
      docInfo.pDocName = "NovaPOS ESC_POS";
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

  chunks.push(escposInit());
  chunks.push(alignCenter());
  chunks.push(doubleHeightWidth(true));
  chunks.push(textLine(request.kind === 'KITCHEN' ? 'TICKET CUISINE' : 'TICKET PAIEMENT'));
  chunks.push(doubleHeightWidth(false));
  chunks.push(bold(true));
  chunks.push(textLine(sanitizeForEscPos(request.order.orderNumber)));
  chunks.push(bold(false));
  chunks.push(
    textLine(
      `${request.kind === 'KITCHEN' ? 'PREPARE' : 'PAYE'} ${formatDateTime(
        request.kind === 'KITCHEN'
          ? request.order.kitchenPrintedAt || request.order.createdAt
          : request.order.paidAt || request.order.createdAt,
      )}`,
    ),
  );
  chunks.push(alignLeft());
  chunks.push(textLine('-'.repeat(width)));

  if (request.kind === 'PAYMENT') {
    chunks.push(textLine(formatColumns(['QTE', 'ARTICLE', 'PRIX'], [4, width - 16, 12], ['right', 'left', 'right'])));
    chunks.push(textLine('-'.repeat(width)));
    for (const line of request.order.lines) {
      for (const renderedLine of formatPaymentEntry(line, width, request.order.currency)) {
        chunks.push(textLine(renderedLine));
      }
    }
    chunks.push(textLine('-'.repeat(width)));
    chunks.push(bold(true));
    chunks.push(textLine(twoColumnLine('TOTAL', formatMoney(request.order.total, request.order.currency), width)));
    chunks.push(bold(false));
    chunks.push(textLine(twoColumnLine('PAIEMENT', sanitizeForEscPos(formatPaymentMethod(request.order.paymentMethod).toUpperCase()), width)));
    chunks.push(openDrawerPulse());
  } else {
    chunks.push(textLine(formatColumns(['QTE', 'ARTICLE'], [4, width - 5], ['right', 'left'])));
    chunks.push(textLine('-'.repeat(width)));
    for (const line of request.order.lines) {
      for (const renderedLine of formatKitchenEntry(line, width)) {
        chunks.push(textLine(renderedLine));
      }
    }
    chunks.push(textLine('-'.repeat(width)));
    chunks.push(textLine(twoColumnLine('LIGNES', String(request.order.lineCount), width)));
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
  chunks.push(alignCenter());
  chunks.push(doubleHeightWidth(true));
  chunks.push(textLine(title));
  chunks.push(doubleHeightWidth(false));
  chunks.push(textLine(centerText(sanitizeForEscPos(request.report.branchName), width)));
  chunks.push(textLine(sanitizeForEscPos(formatDateTime(request.report.generatedAt))));
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

  chunks.push(textLine('-'.repeat(width)));
  chunks.push(textLine(twoColumnLine('TOTAL COMMANDES', String(request.report.orderCount), width)));
  chunks.push(bold(true));
  chunks.push(textLine(twoColumnLine('TOTAL CUMULE', formatMoney(request.report.grandTotal, request.report.currency), width)));
  chunks.push(bold(false));
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
  const amountWidth = width <= 32 ? 10 : 12;
  const quantityWidth = 4;
  const itemWidth = Math.max(8, width - quantityWidth - amountWidth - 2);
  const wrappedName = wrapText(sanitizeForEscPos(line.name), itemWidth);
  const formattedLines = [
    formatColumns(
      [String(line.quantity), wrappedName[0], formatMoney(line.total, currency)],
      [quantityWidth, itemWidth, amountWidth],
      ['right', 'left', 'right'],
    ),
  ];

  for (const continuation of wrappedName.slice(1)) {
    formattedLines.push(formatColumns(['', continuation, ''], [quantityWidth, itemWidth, amountWidth], ['right', 'left', 'right']));
  }

  return formattedLines;
}

function formatKitchenEntry(line: TicketLine, width: number): string[] {
  const quantityWidth = 4;
  const itemWidth = Math.max(8, width - quantityWidth - 1);
  const wrappedName = wrapText(sanitizeForEscPos(line.name), itemWidth);
  const formattedLines = [
    formatColumns([String(line.quantity), wrappedName[0]], [quantityWidth, itemWidth], ['right', 'left']),
  ];

  for (const continuation of wrappedName.slice(1)) {
    formattedLines.push(formatColumns(['', continuation], [quantityWidth, itemWidth], ['right', 'left']));
  }

  return formattedLines;
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

function centerText(value: string, width: number): string {
  const normalized = sanitizeForEscPos(value).slice(0, width);
  const leftPadding = Math.max(0, Math.floor((width - normalized.length) / 2));
  return `${' '.repeat(leftPadding)}${normalized}`;
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
  const headerLines = request.kind === 'KITCHEN' ? 4 : 5;
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

  const totalBlock =
    request.kind === 'PAYMENT'
      ? `
        <div class="divider"></div>
        <div class="summary-row">
          <span>Total</span>
          <strong>${formatMoney(request.order.total, request.order.currency)}</strong>
        </div>
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
  mainWindow = createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
