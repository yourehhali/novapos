import { Injectable, inject } from '@angular/core';
import {
  CompletedOrder,
  PrintSalesSummaryRequest,
  PrinterConfig,
  SalesSummaryReport,
  PrintTicketRequest,
} from '../models/app.models';
import { DesktopBridgeService } from './desktop-bridge.service';
import { WorkspaceService } from './workspace.service';

type TicketKind = PrintTicketRequest['kind'];

@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private readonly desktopBridge = inject(DesktopBridgeService);
  private readonly workspaceService = inject(WorkspaceService);

  async print(order: CompletedOrder): Promise<boolean> {
    if (order.status === 'PAID') {
      return this.printPaymentTicket(order);
    }

    return this.printKitchenTicket(order);
  }

  async printKitchenTicket(order: CompletedOrder): Promise<boolean> {
    return this.printTicket('KITCHEN', order);
  }

  async printPaymentTicket(order: CompletedOrder): Promise<boolean> {
    return this.printTicket('PAYMENT', order);
  }

  async printSalesSummary(report: SalesSummaryReport): Promise<boolean> {
    const printer = await this.resolvePrinter('PAYMENT');

    if (this.desktopBridge.isDesktop()) {
      try {
        const result = await this.desktopBridge.printSalesSummary({ printer, report });
        if (result?.success) {
          return true;
        }

        console.error('[ReceiptService] Desktop sales summary printing failed.', result?.message ?? 'Unknown error.');
      } catch (error) {
        console.error('[ReceiptService] Desktop sales summary printing threw an error.', error);
      }
    }

    return this.printSalesSummaryWithBrowser({ printer, report });
  }

  private async printTicket(kind: TicketKind, order: CompletedOrder): Promise<boolean> {
    const printer = await this.resolvePrinter(kind);

    if (this.desktopBridge.isDesktop()) {
      try {
        const result = await this.desktopBridge.printTicket({ kind, printer, order });
        if (result?.success) {
          return true;
        }

        console.error('[ReceiptService] Desktop printing failed.', result?.message ?? 'Unknown error.');
      } catch (error) {
        console.error('[ReceiptService] Desktop printing threw an error.', error);
      }
    }

    return this.printWithBrowser(kind, order, printer);
  }

  private async resolvePrinter(kind: TicketKind): Promise<PrinterConfig | undefined> {
    const target = kind === 'KITCHEN' ? 'KITCHEN' : 'RECEIPT';

    try {
      const printers = await this.workspaceService.loadPrinters();
      return printers.find((printer) => printer.target === target);
    } catch (error) {
      console.error('[ReceiptService] Unable to load printer configuration.', error);
      return undefined;
    }
  }

  private printWithBrowser(kind: TicketKind, order: CompletedOrder, printer?: PrinterConfig): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const printWindow = window.open('', '_blank', 'popup,width=480,height=760');
    if (!printWindow) {
      console.error('[ReceiptService] Browser popup was blocked.');
      return false;
    }

    printWindow.document.open();
    printWindow.document.write(this.buildBrowserTicketHtml(kind, order, printer));
    printWindow.document.close();
    return true;
  }

  private printSalesSummaryWithBrowser(request: PrintSalesSummaryRequest): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const printWindow = window.open('', '_blank', 'popup,width=480,height=900');
    if (!printWindow) {
      console.error('[ReceiptService] Browser popup was blocked.');
      return false;
    }

    printWindow.document.open();
    printWindow.document.write(this.buildBrowserSalesSummaryHtml(request));
    printWindow.document.close();
    return true;
  }

  private buildBrowserTicketHtml(
    kind: TicketKind,
    order: CompletedOrder,
    printer?: PrinterConfig,
  ): string {
    const paperWidthMm = printer?.paperWidthMm ?? 80;
    const widthCss = paperWidthMm <= 58 ? '54mm' : '74mm';
    const printedAt =
      kind === 'KITCHEN'
        ? this.formatDateTime(order.kitchenPrintedAt || order.createdAt)
        : this.formatDateTime(order.paidAt || order.createdAt);

    const lineRows = order.lines
      .map((line) => {
        const priceCell =
          kind === 'PAYMENT'
            ? `<td class="price">${this.formatMoney(line.total, order.currency)}</td>`
            : '';

        return `
          <tr>
            <td class="qty">${line.quantity}</td>
            <td class="item">${this.escapeHtml(line.name)}</td>
            ${priceCell}
          </tr>
        `;
      })
      .join('');

    const summaryBlock =
      kind === 'PAYMENT'
        ? `
          <div class="divider"></div>
          <div class="summary-row">
            <span>Total</span>
            <strong>${this.formatMoney(order.total, order.currency)}</strong>
          </div>
          <div class="summary-row meta-row">
            <span>Paiement</span>
            <span>${this.formatPaymentMethod(order.paymentMethod)}</span>
          </div>
        `
        : `
          <div class="divider"></div>
          <div class="summary-row meta-row">
            <span>Lignes</span>
            <span>${order.lineCount}</span>
          </div>
        `;

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${kind === 'KITCHEN' ? 'Ticket Cuisine' : 'Ticket Paiement'}</title>
          <style>
            @page {
              size: ${paperWidthMm}mm auto;
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
              padding: 1.5mm 2mm 2mm;
              font-size: ${kind === 'KITCHEN' ? '11px' : '10px'};
              line-height: 1.2;
            }

            .header {
              text-align: center;
              margin-bottom: 4px;
            }

            .header h1 {
              margin: 0 0 1px;
              font-size: ${kind === 'KITCHEN' ? '15px' : '14px'};
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
              width: ${kind === 'PAYMENT' ? '18mm' : '0'};
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
        <body>
          <div class="header">
            <h1>${kind === 'KITCHEN' ? 'Ticket Cuisine' : 'Ticket Paiement'}</h1>
            <div class="meta">
              <div>${this.escapeHtml(order.orderNumber)}</div>
              <div>${kind === 'KITCHEN' ? 'Prepare' : 'Paye'} ${this.escapeHtml(printedAt)}</div>
            </div>
          </div>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th class="qty">Qte</th>
                <th class="item">Article</th>
                ${kind === 'PAYMENT' ? '<th class="price">Prix</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${lineRows}
            </tbody>
          </table>
          ${summaryBlock}
          <script>
            window.addEventListener('load', () => {
              window.print();
              window.setTimeout(() => window.close(), 150);
            });
          </script>
        </body>
      </html>
    `;
  }

  private buildBrowserSalesSummaryHtml(request: PrintSalesSummaryRequest): string {
    const paperWidthMm = request.printer?.paperWidthMm ?? 80;
    const widthCss = paperWidthMm <= 58 ? '54mm' : '74mm';
    const lineRows = request.report.entries.length > 0
      ? request.report.entries
          .map((entry) => `
            <tr>
              <td class="time">${this.escapeHtml(this.formatTime(entry.paidAt))}</td>
              <td class="item">${this.escapeHtml(entry.orderNumber)}</td>
              <td class="price">${this.formatMoney(entry.total, entry.currency)}</td>
            </tr>
          `)
          .join('')
      : `
        <tr>
          <td class="time">--:--</td>
          <td class="item">Aucune commande payee</td>
          <td class="price">${this.formatMoney(0, request.report.currency)}</td>
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
              size: ${paperWidthMm}mm auto;
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
              padding: 1.5mm 2mm 2mm;
              font-size: 10px;
              line-height: 1.2;
            }

            .header {
              text-align: center;
              margin-bottom: 4px;
            }

            .header h1 {
              margin: 0 0 1px;
              font-size: 14px;
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
              margin: 1px 0;
            }

            .summary-row strong {
              font-size: 11px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Total Journalier</h1>
            <div class="meta">
              <div>Succursale ${this.escapeHtml(request.report.branchName)}</div>
              <div>${request.report.range === 'DAY_START' ? 'Depuis debut de journee' : 'Depuis dernier total imprime'}</div>
              <div>Periode ${this.escapeHtml(this.formatDateTime(request.report.fromAt))} -> ${this.escapeHtml(this.formatDateTime(request.report.toAt))}</div>
              <div>Imprime ${this.escapeHtml(this.formatDateTime(request.report.generatedAt))}</div>
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
            <strong>${this.formatMoney(request.report.grandTotal, request.report.currency)}</strong>
          </div>
          <script>
            window.addEventListener('load', () => {
              window.print();
              window.setTimeout(() => window.close(), 150);
            });
          </script>
        </body>
      </html>
    `;
  }

  private formatDateTime(value: string): string {
    return new Date(value).toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatMoney(value: number, currency: string): string {
    return `${value.toFixed(2)} ${currency}`;
  }

  private formatTime(value: string): string {
    return new Date(value).toLocaleString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatPaymentMethod(paymentMethod: string): string {
    if (paymentMethod === 'CARD') {
      return 'Carte';
    }

    if (paymentMethod === 'CASH') {
      return 'Especes';
    }

    return 'Non paye';
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
