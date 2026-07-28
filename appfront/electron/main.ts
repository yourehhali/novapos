import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';

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
  const printWindow = new BrowserWindow({
    show: false,
    width: mapWidthToWindowPx(request.printer?.paperWidthMm ?? 80),
    height: 900,
    backgroundColor: '#ffffff',
    webPreferences: {
      sandbox: true,
    },
  });

  const html = buildTicketHtml(request);
  await printWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);

  const deviceName =
    request.printer?.systemPrinterName || request.printer?.name || request.printer?.queueName || undefined;
  const pageSize = buildPageSizeMicrons(request);

  try {
    const result = await new Promise<{ success: boolean; failureReason?: string }>((resolve) => {
      printWindow.webContents.print(
        {
          silent: request.printer?.silent ?? true,
          printBackground: true,
          deviceName,
          margins: {
            marginType: 'none',
          },
          pageSize,
        },
          (success: boolean, failureReason: string) => resolve({ success, failureReason }),
      );
    });

    if (!result.success && deviceName) {
      const fallbackResult = await new Promise<{ success: boolean; failureReason?: string }>((resolve) => {
        printWindow.webContents.print(
          {
            silent: request.printer?.silent ?? true,
            printBackground: true,
            margins: {
              marginType: 'none',
            },
            pageSize,
          },
          (success: boolean, failureReason: string) => resolve({ success, failureReason }),
        );
      });

      return {
        success: fallbackResult.success,
        message: fallbackResult.success
          ? `Printed using the default printer because ${deviceName} was unavailable.`
          : fallbackResult.failureReason || 'Desktop printing failed.',
        printerName: fallbackResult.success ? 'default' : deviceName,
      };
    }

    return {
      success: result.success,
      message: result.success ? 'Printed successfully.' : result.failureReason || 'Desktop printing failed.',
      printerName: deviceName,
    };
  } finally {
    printWindow.close();
  }
}

async function printSalesSummary(request: PrintSalesSummaryRequest): Promise<{
  success: boolean;
  message: string;
  printerName?: string;
}> {
  const printWindow = new BrowserWindow({
    show: false,
    width: mapWidthToWindowPx(request.printer?.paperWidthMm ?? 80),
    height: 1100,
    backgroundColor: '#ffffff',
    webPreferences: {
      sandbox: true,
    },
  });

  const html = buildSalesSummaryHtml(request);
  await printWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);

  const deviceName =
    request.printer?.systemPrinterName || request.printer?.name || request.printer?.queueName || undefined;
  const pageSize = {
    width: (request.printer?.paperWidthMm ?? 80) * 1000,
    height: estimateSalesSummaryHeightMm(request) * 1000,
  };

  try {
    const result = await new Promise<{ success: boolean; failureReason?: string }>((resolve) => {
      printWindow.webContents.print(
        {
          silent: request.printer?.silent ?? true,
          printBackground: true,
          deviceName,
          margins: {
            marginType: 'none',
          },
          pageSize,
        },
        (success: boolean, failureReason: string) => resolve({ success, failureReason }),
      );
    });

    if (!result.success && deviceName) {
      const fallbackResult = await new Promise<{ success: boolean; failureReason?: string }>((resolve) => {
        printWindow.webContents.print(
          {
            silent: request.printer?.silent ?? true,
            printBackground: true,
            margins: {
              marginType: 'none',
            },
            pageSize,
          },
          (success: boolean, failureReason: string) => resolve({ success, failureReason }),
        );
      });

      return {
        success: fallbackResult.success,
        message: fallbackResult.success
          ? `Printed using the default printer because ${deviceName} was unavailable.`
          : fallbackResult.failureReason || 'Desktop summary printing failed.',
        printerName: fallbackResult.success ? 'default' : deviceName,
      };
    }

    return {
      success: result.success,
      message: result.success
        ? 'Printed successfully.'
        : result.failureReason || 'Desktop summary printing failed.',
      printerName: deviceName,
    };
  } finally {
    printWindow.close();
  }
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
  const reservedChars = request.kind === 'KITCHEN' ? 6 : 14;
  const itemChars = Math.max(12, charsPerLine - reservedChars);
  const wrappedLineCount = request.order.lines.reduce((total, line) => {
    const normalizedLength = line.name.trim().length || 1;
    return total + Math.max(1, Math.ceil(normalizedLength / itemChars));
  }, 0);
  const headerLines = request.kind === 'KITCHEN' ? 8 : 10;
  const footerLines = request.kind === 'KITCHEN' ? 4 : 6;
  const totalTextLines = headerLines + footerLines + wrappedLineCount;
  const heightMm = paperWidthMm <= 58
    ? 18 + totalTextLines * 4.3
    : 20 + totalTextLines * 4.0;

  return Math.max(58, Math.min(220, Math.ceil(heightMm)));
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
          <span>Articles</span>
          <span>${request.order.lineCount} lignes</span>
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
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #111111;
            font-family: "SF Mono", "Menlo", "Consolas", monospace;
            width: ${widthCss};
          }

          body {
            padding: 3mm;
            font-size: ${request.kind === 'KITCHEN' ? '11px' : '10px'};
            line-height: 1.2;
          }

          .header {
            text-align: center;
            margin-bottom: 8px;
          }

          .header h1 {
            margin: 0 0 3px;
            font-size: ${request.kind === 'KITCHEN' ? '18px' : '16px'};
            letter-spacing: 0.02em;
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
      <body class="${bodyClass}">
        <div class="header">
          <h1>${request.kind === 'KITCHEN' ? 'Ticket Cuisine' : 'Ticket Paiement'}</h1>
          <div class="meta">
            <div>Commande ${escapeHtml(request.order.orderNumber)}</div>
            <div>Caissier ${escapeHtml(request.order.cashierName)}</div>
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
        <div class="footer">
          ${request.kind === 'KITCHEN'
            ? 'Preparation locale sans interruption.'
            : 'Impression locale depuis le poste de caisse.'}
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
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #111111;
            font-family: "SF Mono", "Menlo", "Consolas", monospace;
            width: ${widthCss};
          }

          body {
            padding: 3mm;
            font-size: 10px;
            line-height: 1.2;
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
        <div class="footer">
          Impression locale depuis le poste de caisse.
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
