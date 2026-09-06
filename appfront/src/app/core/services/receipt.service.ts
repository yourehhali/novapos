import { Injectable, inject } from '@angular/core';
import {
  BusinessSettings,
  CompletedOrder,
  DeliveryDriver,
  LogoType,
  PrintSalesSummaryRequest,
  PrinterConfig,
  SalesSummaryReport,
  PrintTicketRequest,
  PrintTicketResult,
} from '../models/app.models';
import { NovaPosDbService } from '../../offline/novapos-db.service';
import { AppModalService } from './app-modal.service';
import { BusinessSettingsService, DEFAULT_BUSINESS_SETTINGS } from './business-settings.service';
import { DesktopBridgeService } from './desktop-bridge.service';

type TicketKind = PrintTicketRequest['kind'];
const DESKTOP_TIMEOUT_MS = 450;
const DESKTOP_ESCPOS_TIMEOUT_MS = 5000;

@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private readonly appModal = inject(AppModalService);
  private readonly desktopBridge = inject(DesktopBridgeService);
  private readonly businessSettingsService = inject(BusinessSettingsService);
  private readonly db = inject(NovaPosDbService);

  private settingsCache: BusinessSettings | null = null;
  private driversCache: DeliveryDriver[] | null = null;

  async print(order: CompletedOrder): Promise<boolean> {
    return order.status === 'PAID' ? this.printPaymentTicket(order) : this.printKitchenTicket(order);
  }

  async printKitchenTicket(order: CompletedOrder): Promise<boolean> {
    return this.printTicket('KITCHEN', order);
  }

  async printPaymentTicket(order: CompletedOrder): Promise<boolean> {
    return this.printTicket('PAYMENT', order);
  }

  async printSalesSummary(report: SalesSummaryReport): Promise<boolean> {
    const settings = await this.loadSettings();
    const printer = this.resolvePrinterFromSettings('PAYMENT', settings);
    const html = this.buildSalesSummaryHtml({ printer, report }, settings);

    let desktopFailure: string | null = null;
    if (this.desktopBridge.isDesktop()) {
      try {
        const desktopPromise = this.desktopBridge.printSalesSummary({
          printer,
          report,
          html,
          paperWidthMm: printer?.paperWidthMm ?? settings.receiptPaperWidthMm,
          systemPrinterName: printer?.systemPrinterName || printer?.name,
          silent: printer?.silent ?? true,
          settings,
        });
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), DESKTOP_ESCPOS_TIMEOUT_MS));
        const result = await Promise.race([desktopPromise, timeout]);
        if (result?.success) return true;
        if (result) desktopFailure = this.describePrintFailure(result, 'Desktop sales summary printing failed.');
      } catch (error) {
        desktopFailure = this.describeUnknownError(error, 'Desktop sales summary printing failed.');
      }
    }

    const browserResult = this.printViaIframe(html);
    if (browserResult.success) return true;

    this.showPrintError(
      'Impression du total impossible',
      'Le total journalier n a pas pu etre imprime.',
      desktopFailure ?? browserResult.message,
    );
    return false;
  }

  private async printTicket(kind: TicketKind, order: CompletedOrder): Promise<boolean> {
    const [settings, drivers] = await Promise.all([this.loadSettings(), this.loadDrivers()]);
    const printer = this.resolvePrinterFromSettings(kind, settings);
    const html = this.buildTicketHtml(kind, order, printer, settings, drivers);
    const paperWidthMm = printer?.paperWidthMm ?? (kind === 'KITCHEN' ? settings.kitchenPaperWidthMm : settings.receiptPaperWidthMm);

    let desktopFailure: string | null = null;
    if (this.desktopBridge.isDesktop()) {
      try {
        const desktopPromise = this.desktopBridge.printTicket({
          kind,
          printer,
          order,
          html,
          paperWidthMm,
          systemPrinterName: printer?.systemPrinterName || printer?.name,
          silent: printer?.silent ?? true,
          settings,
        });
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), DESKTOP_ESCPOS_TIMEOUT_MS));
        const result = await Promise.race([desktopPromise, timeout]);
        if (result?.success) return true;
        if (result) desktopFailure = this.describePrintFailure(result, 'Desktop printing failed.');
      } catch (error) {
        desktopFailure = this.describeUnknownError(error, 'Desktop printing failed.');
      }
    }

    const browserResult = this.printViaIframe(html);
    if (browserResult.success) return true;

    const ticketLabel = kind === 'KITCHEN' ? 'le ticket cuisine' : 'le ticket de paiement';
    this.showPrintError(
      'Impression impossible',
      `Nous n avons pas pu imprimer ${ticketLabel}.`,
      desktopFailure ?? browserResult.message,
    );
    return false;
  }

  private async loadSettings(): Promise<BusinessSettings> {
    if (this.settingsCache) return this.settingsCache;
    try {
      this.settingsCache = await this.businessSettingsService.load();
    } catch {
      this.settingsCache = DEFAULT_BUSINESS_SETTINGS;
    }
    return this.settingsCache!;
  }

  private async loadDrivers(): Promise<DeliveryDriver[]> {
    if (this.driversCache) return this.driversCache;
    try {
      this.driversCache = await this.db.deliveryDrivers.toArray();
    } catch {
      this.driversCache = [];
    }
    return this.driversCache!;
  }

  invalidateSettingsCache(): void {
    this.settingsCache = null;
    this.driversCache = null;
  }

  private formatChannel(order: CompletedOrder, drivers: DeliveryDriver[]): string[] {
    const lines: string[] = [];
    const channel =
      order.channel === 'EMPORTER' || order.channel === 'LIVRAISON' || order.channel === 'SUR_PLACE'
        ? order.channel
        : 'SUR_PLACE';
    switch (channel) {
      case 'SUR_PLACE':
        lines.push(`Canal: Sur place`);
        if (order.tableNumber) lines.push(`Table: ${order.tableNumber}`);
        break;
      case 'EMPORTER':
        lines.push(`Canal: A emporter`);
        break;
      case 'LIVRAISON':
        lines.push('Canal: Livraison');
        if (order.livreurId) {
          const driver = drivers.find((d) => d.id === order.livreurId);
          const label = driver ? `N°${driver.number} - ${driver.name}` : order.livreurId;
          lines.push(`Livreur: ${label}`);
        }
        break;
    }
    if (order.customerPhone) lines.push(`Tel: ${order.customerPhone}`);
    if (order.deliveryAddress) lines.push(`Adresse: ${order.deliveryAddress}`);
    return lines;
  }

  private resolvePrinterFromSettings(kind: TicketKind, settings: BusinessSettings): PrinterConfig {
    const isKitchen = kind === 'KITCHEN';
    const name = isKitchen ? settings.kitchenPrinterName : settings.receiptPrinterName;
    const queueName = isKitchen ? settings.kitchenQueueName : settings.receiptQueueName;
    const ip = isKitchen ? settings.kitchenPrinterIp : settings.receiptPrinterIp;
    const paperWidthMm = isKitchen ? settings.kitchenPaperWidthMm : settings.receiptPaperWidthMm;
    const target = isKitchen ? 'KITCHEN' : 'RECEIPT';
    const hostOrQueue = ip?.trim() || queueName?.trim();
    const width = paperWidthMm ?? 80;
    return {
      id: isKitchen ? 'kitchen-local' : 'receipt-local',
      name: name?.trim() || 'Impression locale',
      target,
      protocol: ip?.trim() ? 'ESC_POS_IP' : 'BROWSER',
      queueName: hostOrQueue || queueName || target,
      paperWidthMm: width,
      charactersPerLine: width <= 58 ? 28 : 42,
      printMode: 'THERMAL',
      silent: true,
      systemPrinterName: name?.trim() || '',
    };
  }

  private printViaIframe(html: string): { success: boolean; message?: string } {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return { success: false, message: 'Environnement navigateur non disponible.' };
    }
    try {
      let iframe = document.getElementById('__novapos_print_iframe__') as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = this.createIframe();
      } else {
        try {
          iframe.contentWindow?.document.open();
        } catch {
          iframe.remove();
          iframe = this.createIframe();
        }
      }
      const doc = iframe.contentWindow?.document;
      if (!doc) return { success: false, message: 'Document iframe inaccessible.' };

      doc.open();
      doc.write(html);
      doc.close();

      const trigger = () => {
        try {
          iframe?.contentWindow?.focus();
          setTimeout(() => {
            try { iframe?.contentWindow?.print(); } catch { /* noop */ }
          }, 8);
        } catch { /* noop */ }
      };

      const win = iframe.contentWindow as unknown as { document?: { readyState?: string } } | null;
      if (win?.document?.readyState === 'complete') {
        trigger();
      } else {
        iframe.onload = () => trigger();
      }
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  private createIframe(): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    iframe.id = '__novapos_print_iframe__';
    iframe.setAttribute(
      'style',
      'position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;',
    );
    document.body.appendChild(iframe);
    return iframe;
  }

  private buildTicketHtml(
    kind: TicketKind,
    order: CompletedOrder,
    printer: PrinterConfig | undefined,
    settings: BusinessSettings,
    drivers: DeliveryDriver[] = [],
  ): string {
    const paperWidthMm = printer?.paperWidthMm ?? settings.receiptPaperWidthMm ?? 80;
    const pageHeightMm = this.estimateTicketHeight(kind, order, printer);
    const widthCss = paperWidthMm <= 58 ? '54mm' : '74mm';
    const printedAt = this.formatDateTime(
      kind === 'KITCHEN' ? (order.kitchenPrintedAt || order.createdAt) : (order.paidAt || order.createdAt),
    );

    const lineRows = order.lines.map((line) => {
      const priceCell = kind === 'PAYMENT'
        ? `<td class="price">${this.formatMoney(line.total, order.currency)}</td>`
        : '';
      return `<tr><td class="qty">${line.quantity}</td><td class="item">${this.escapeHtml(line.name)}</td>${priceCell}</tr>`;
    }).join('');

    const summaryBlock = kind === 'PAYMENT'
      ? `
        <div class="divider"></div>
        <div class="summary-row"><span>Total</span><strong>${this.formatMoney(order.total, order.currency)}</strong></div>
        <div class="summary-row meta-row"><span>Paiement</span><span>${this.formatPaymentMethod(order.paymentMethod)}</span></div>
      `
      : `
        <div class="divider"></div>
        <div class="summary-row meta-row"><span>Lignes</span><span>${order.lineCount}</span></div>
      `;

    const logoBlock = this.renderLogo(settings);
    const heading = this.renderHeading(settings, kind);
    const businessBlock = this.renderBusinessInfo(settings);
    const footer = this.renderFooter(settings);
    const channelLines = this.formatChannel(order, drivers);

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${kind === 'KITCHEN' ? 'Ticket Cuisine' : 'Ticket Paiement'}</title>
          <style>
            @page { size: ${paperWidthMm}mm ${pageHeightMm}mm; margin: 0; }
            html, body { margin: 0 !important; padding: 0 !important; background: #fff; color: #111; font-family: "Courier New","SF Mono","Menlo","Consolas",monospace; width: ${widthCss}; min-height: 0; height: auto; }
            body { display:flex; align-items:flex-start; padding:0; font-size: ${kind === 'KITCHEN' ? '11px' : '10px'}; line-height:1.2; overflow:hidden; }
            .ticket-root { width: ${widthCss}; box-sizing:border-box; margin:0; padding: 0.6mm 2mm 2mm; }
            .header { text-align:center; margin-bottom: 4px; }
            .logo { margin: 0 0 3px; display:flex; justify-content:center; align-items:center; }
            .logo-text { font-size: ${kind === 'KITCHEN' ? '22px' : '18px'}; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; padding: 2px 8px; border: 2px solid #111; border-radius: 2px; display: inline-block; }
            .logo-img { max-height: 22mm; max-width: 100%; }
            .business-name { margin: 0; font-size: ${kind === 'KITCHEN' ? '13px' : '12px'}; font-weight: 800; text-transform: uppercase; }
            .ticket-title { margin: 0; font-size: ${kind === 'KITCHEN' ? '13px' : '12px'}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
            .ticket-subheading { margin: 1px 0 0; font-size: 9px; color: #333; }
            .business-info { margin: 2px 0 0; font-size: 9px; line-height: 1.2; white-space: pre-line; }
            .meta { display: grid; gap: 1px; font-size: 9px; }
            .divider { border-top: 1px dashed #222; margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td { padding: 1px 0; vertical-align: top; }
            thead th { font-size: 9px; font-weight: 700; text-transform: uppercase; }
            .qty { width: 10mm; }
            .item { width: auto; padding-right: 4px; word-break: break-word; }
            .price { width: ${kind === 'PAYMENT' ? '18mm' : '0'}; text-align: right; }
            .summary-row { display: flex; justify-content: space-between; gap: 8px; margin: 1px 0; }
            .summary-row strong { font-size: 11px; }
            .meta-row { font-size: 9px; color: #333; }
            .footer { margin-top: 4px; text-align: center; font-size: 9px; white-space: pre-line; line-height: 1.2; }
          </style>
        </head>
        <body>
          <div class="ticket-root">
            <div class="header">
              ${logoBlock}
              ${businessBlock}
              ${heading}
              <div class="meta">
                <div>${this.escapeHtml(order.orderNumber)}</div>
                ${channelLines.map((l) => `<div>${this.escapeHtml(l)}</div>`).join('')}
                <div>${kind === 'KITCHEN' ? 'Prepare' : 'Paye'} ${this.escapeHtml(printedAt)}</div>
              </div>
            </div>
            <div class="divider"></div>
            <table>
              <thead><tr><th class="qty">Qte</th><th class="item">Article</th>${kind === 'PAYMENT' ? '<th class="price">Prix</th>' : ''}</tr></thead>
              <tbody>${lineRows}</tbody>
            </table>
            ${summaryBlock}
            ${footer}
          </div>
        </body>
      </html>
    `;
  }

  private buildSalesSummaryHtml(
    request: PrintSalesSummaryRequest,
    settings: BusinessSettings,
  ): string {
    const paperWidthMm = request.printer?.paperWidthMm ?? settings.receiptPaperWidthMm ?? 80;
    const pageHeightMm = this.estimateSummaryHeight(request);
    const widthCss = paperWidthMm <= 58 ? '54mm' : '74mm';
    const lineRows = request.report.entries.length > 0
      ? request.report.entries.map((entry) => `
          <tr>
            <td class="time">${this.escapeHtml(this.formatTime(entry.paidAt))}</td>
            <td class="item">${this.escapeHtml(entry.orderNumber)}</td>
            <td class="price">${this.formatMoney(entry.total, entry.currency)}</td>
          </tr>
        `).join('')
      : `<tr><td class="time">--:--</td><td class="item">Aucune commande payee</td><td class="price">${this.formatMoney(0, request.report.currency)}</td></tr>`;

    const logoBlock = this.renderLogo(settings);
    const businessBlock = this.renderBusinessInfo(settings);
    const footer = this.renderFooter(settings);

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Total Journalier</title>
          <style>
            @page { size: ${paperWidthMm}mm ${pageHeightMm}mm; margin: 0; }
            html, body { margin: 0 !important; padding: 0 !important; background: #fff; color: #111; font-family: "Courier New","SF Mono","Menlo","Consolas",monospace; width: ${widthCss}; min-height: 0; height: auto; }
            body { display:flex; align-items:flex-start; padding:0; font-size: 10px; line-height:1.2; overflow:hidden; }
            .ticket-root { width: ${widthCss}; box-sizing:border-box; margin:0; padding: 0.6mm 2mm 2mm; }
            .header { text-align:center; margin-bottom: 4px; }
            .logo { margin: 0 0 3px; display:flex; justify-content:center; align-items:center; }
            .logo-text { font-size: 18px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; padding: 2px 8px; border: 2px solid #111; border-radius: 2px; display: inline-block; }
            .logo-img { max-height: 22mm; max-width: 100%; }
            .business-name { margin: 0; font-size: 12px; font-weight: 800; text-transform: uppercase; }
            .ticket-title { margin: 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
            .business-info { margin: 2px 0 0; font-size: 9px; line-height: 1.2; white-space: pre-line; }
            .meta { display: grid; gap: 1px; font-size: 9px; }
            .divider { border-top: 1px dashed #222; margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td { padding: 1px 0; vertical-align: top; }
            thead th { font-size: 9px; font-weight: 700; text-transform: uppercase; }
            .time { width: 14mm; }
            .item { width: auto; padding-right: 4px; word-break: break-word; }
            .price { width: 20mm; text-align: right; }
            .summary-row { display: flex; justify-content: space-between; gap: 8px; margin: 1px 0; }
            .summary-row strong { font-size: 11px; }
            .footer { margin-top: 4px; text-align: center; font-size: 9px; white-space: pre-line; line-height: 1.2; }
          </style>
        </head>
        <body>
          <div class="ticket-root">
            <div class="header">
              ${logoBlock}
              ${businessBlock}
              <h1 class="ticket-title">Total Journalier</h1>
              <div class="meta">
                <div>Succursale ${this.escapeHtml(request.report.branchName)}</div>
                <div>${request.report.range === 'DAY_START' ? 'Depuis debut de journee' : 'Depuis dernier total imprime'}</div>
                <div>Periode ${this.escapeHtml(this.formatDateTime(request.report.fromAt))} - ${this.escapeHtml(this.formatDateTime(request.report.toAt))}</div>
                <div>Imprime ${this.escapeHtml(this.formatDateTime(request.report.generatedAt))}</div>
              </div>
            </div>
            <div class="divider"></div>
            <table>
              <thead><tr><th class="time">Heure</th><th class="item">Commande</th><th class="price">Montant</th></tr></thead>
              <tbody>${lineRows}</tbody>
            </table>
            <div class="divider"></div>
            <div class="summary-row"><span>Total commandes</span><strong>${request.report.orderCount}</strong></div>
            <div class="summary-row"><span>Total cumule</span><strong>${this.formatMoney(request.report.grandTotal, request.report.currency)}</strong></div>
            ${footer}
          </div>
        </body>
      </html>
    `;
  }

  private estimateTicketHeight(kind: TicketKind, order: CompletedOrder, printer?: PrinterConfig): number {
    const paperWidthMm = printer?.paperWidthMm ?? 80;
    const charsPerLine = printer?.charactersPerLine ?? (paperWidthMm <= 58 ? 28 : 42);
    const reservedChars = 12;
    const itemChars = Math.max(12, charsPerLine - reservedChars);
    const wrappedLineCount = order.lines.reduce((total, line) => {
      const normalizedLength = Math.max(1, line.name.trim().length);
      return total + Math.max(1, Math.ceil(normalizedLength / itemChars));
    }, 0);
    const headerLines = 10;
    const footerLines = 4;
    const totalTextLines = headerLines + footerLines + wrappedLineCount;
    const heightMm = paperWidthMm <= 58
      ? 10 + totalTextLines * 3.8
      : 12 + totalTextLines * 3.6;
    return Math.max(36, Math.min(200, Math.ceil(heightMm)));
  }

  private estimateSummaryHeight(request: PrintSalesSummaryRequest): number {
    const paperWidthMm = request.printer?.paperWidthMm ?? 80;
    const headerLines = 11;
    const footerLines = 4;
    const bodyLines = Math.max(2, request.report.entries.length) + 3;
    const totalLines = headerLines + footerLines + bodyLines;
    const heightMm = paperWidthMm <= 58
      ? 22 + totalLines * 4.6
      : 24 + totalLines * 4.2;
    return Math.max(80, Math.min(380, Math.ceil(heightMm)));
  }

  private renderLogo(settings: BusinessSettings): string {
    if (settings.logoType === ('IMAGE' as LogoType) && settings.logoImageDataUrl?.trim()) {
      return `<div class="logo"><img class="logo-img" src="${this.escapeAttr(settings.logoImageDataUrl.trim())}" alt="" /></div>`;
    }
    const text = (settings.logoText?.trim() || settings.businessName?.trim() || 'HM').slice(0, 14);
    return `<div class="logo"><span class="logo-text">${this.escapeHtml(text)}</span></div>`;
  }

  private renderHeading(settings: BusinessSettings, _kind: TicketKind): string {
    const heading = settings.ticketHeading?.trim();
    const subheading = settings.ticketSubheading?.trim();
    if (!heading && !subheading) return '';
    return [
      heading ? `<h1 class="ticket-title">${this.escapeHtml(heading)}</h1>` : '',
      subheading ? `<p class="ticket-subheading">${this.escapeHtml(subheading)}</p>` : '',
    ].join('');
  }

  private renderBusinessInfo(settings: BusinessSettings): string {
    const lines: string[] = [];
    if (settings.businessName?.trim()) {
      lines.push(`<p class="business-name">${this.escapeHtml(settings.businessName.trim())}</p>`);
    }
    const details: string[] = [];
    if (settings.addressLine1?.trim()) details.push(settings.addressLine1.trim());
    if (settings.addressLine2?.trim()) details.push(settings.addressLine2.trim());
    if (settings.phone?.trim()) details.push(`Tel: ${settings.phone.trim()}`);
    if (settings.taxLabel?.trim() && settings.taxNumber?.trim()) {
      details.push(`${settings.taxLabel.trim()}: ${settings.taxNumber.trim()}`);
    } else if (settings.taxNumber?.trim()) {
      details.push(settings.taxNumber.trim());
    }
    if (details.length > 0) {
      lines.push(`<div class="business-info">${details.map((s) => this.escapeHtml(s)).join('\n')}</div>`);
    }
    return lines.join('');
  }

  private renderFooter(settings: BusinessSettings): string {
    const lines = [settings.footerLine1, settings.footerLine2, settings.footerLine3]
      .map((line) => line?.trim())
      .filter(Boolean) as string[];
    if (lines.length === 0) return '';
    return `<div class="divider"></div><div class="footer">${lines.map((s) => this.escapeHtml(s)).join('\n')}</div>`;
  }

  private describePrintFailure(result: PrintTicketResult | null, fallback: string): string {
    if (!result) return fallback;
    return result.printerName ? `${result.message} Imprimante cible: ${result.printerName}.` : result.message;
  }

  private describeUnknownError(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  private showPrintError(title: string, message: string, details?: string): void {
    this.appModal.openError(title, message, details);
  }

  private formatDateTime(value: string): string {
    return new Date(value).toLocaleString('fr-FR', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }

  private formatMoney(value: number, currency: string): string {
    return `${value.toFixed(2)} ${currency}`;
  }

  private formatTime(value: string): string {
    return new Date(value).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  private formatPaymentMethod(paymentMethod: string): string {
    if (paymentMethod === 'CARD') return 'Carte';
    if (paymentMethod === 'CASH') return 'Especes';
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

  private escapeAttr(value: string): string {
    return value.replaceAll('"', '&quot;');
  }
}
