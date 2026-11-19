import { Injectable, inject } from '@angular/core';
import {
  BusinessSettings,
  CompletedOrder,
  PrintSalesSummaryRequest,
  PrinterConfig,
  SalesSummaryReport,
  PrintTicketRequest,
  PrintTicketResult,
} from '../models/app.models';
import { AppModalService } from './app-modal.service';
import { BusinessSettingsService, DEFAULT_BUSINESS_SETTINGS } from './business-settings.service';
import { DesktopBridgeService } from './desktop-bridge.service';
import { LanguageService } from '../i18n/language.service';

type TicketKind = PrintTicketRequest['kind'];
const DESKTOP_ESCPOS_TIMEOUT_MS = 5000;

@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private readonly appModal = inject(AppModalService);
  private readonly desktopBridge = inject(DesktopBridgeService);
  private readonly businessSettingsService = inject(BusinessSettingsService);
  protected readonly lang = inject(LanguageService);

  private settingsCache: BusinessSettings | null = null;

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

    if (!this.desktopBridge.isDesktop()) {
      this.showPrintError(
        this.lang.t('services.salesSummaryPrintFailedTitle'),
        this.lang.t('services.salesSummaryPrintFailedMessage'),
        this.lang.t('services.desktopAppRequired'),
      );
      return false;
    }

    try {
      const desktopPromise = this.desktopBridge.printSalesSummary({
        printer,
        report,
        paperWidthMm: printer?.paperWidthMm ?? settings.receiptPaperWidthMm,
        systemPrinterName: printer?.systemPrinterName || printer?.name,
        silent: printer?.silent ?? true,
        settings,
      } as PrintSalesSummaryRequest);
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), DESKTOP_ESCPOS_TIMEOUT_MS));
      const result = await Promise.race([desktopPromise, timeout]);
      if (result?.success) return true;
      this.showPrintError(
        this.lang.t('services.salesSummaryPrintFailedTitle'),
        this.lang.t('services.salesSummaryPrintFailedMessage'),
        result ? this.describePrintFailure(result, this.lang.t('services.desktopSummaryPrintFailed')) : this.lang.t('services.printTimeout'),
      );
      return false;
    } catch (error) {
      this.showPrintError(
        this.lang.t('services.salesSummaryPrintFailedTitle'),
        this.lang.t('services.salesSummaryPrintFailedMessage'),
        this.describeUnknownError(error, this.lang.t('services.desktopSummaryPrintFailed')),
      );
      return false;
    }
  }

  private async printTicket(kind: TicketKind, order: CompletedOrder): Promise<boolean> {
    const settings = await this.loadSettings();
    const printer = this.resolvePrinterFromSettings(kind, settings);
    const paperWidthMm = printer?.paperWidthMm ?? (kind === 'KITCHEN' ? settings.kitchenPaperWidthMm : settings.receiptPaperWidthMm);

    if (!this.desktopBridge.isDesktop()) {
      const ticketLabel = kind === 'KITCHEN' ? this.lang.t('services.kitchenTicketLabel') : this.lang.t('services.paymentTicketLabel');
      this.showPrintError(
        this.lang.t('services.printNotPossible'),
        this.lang.t('services.printTicketFailed', { ticket: ticketLabel }),
        this.lang.t('services.desktopAppRequired'),
      );
      return false;
    }

    try {
      const desktopPromise = this.desktopBridge.printTicket({
        kind,
        printer,
        order,
        paperWidthMm,
        systemPrinterName: printer?.systemPrinterName || printer?.name,
        silent: printer?.silent ?? true,
        settings,
      } as PrintTicketRequest);
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), DESKTOP_ESCPOS_TIMEOUT_MS));
      const result = await Promise.race([desktopPromise, timeout]);
      if (result?.success) return true;
      const ticketLabel = kind === 'KITCHEN' ? this.lang.t('services.kitchenTicketLabel') : this.lang.t('services.paymentTicketLabel');
      this.showPrintError(
        this.lang.t('services.printNotPossible'),
        this.lang.t('services.printTicketFailed', { ticket: ticketLabel }),
        result ? this.describePrintFailure(result, this.lang.t('services.desktopPrintFailed')) : this.lang.t('services.printTimeout'),
      );
      return false;
    } catch (error) {
      const ticketLabel = kind === 'KITCHEN' ? this.lang.t('services.kitchenTicketLabel') : this.lang.t('services.paymentTicketLabel');
      this.showPrintError(
        this.lang.t('services.printNotPossible'),
        this.lang.t('services.printTicketFailed', { ticket: ticketLabel }),
        this.describeUnknownError(error, this.lang.t('services.desktopPrintFailed')),
      );
      return false;
    }
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

  invalidateSettingsCache(): void {
    this.settingsCache = null;
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
      name: name?.trim() || this.lang.t('services.localPrint'),
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

  private describePrintFailure(result: PrintTicketResult | null, fallback: string): string {
    if (!result) return fallback;
    return result.printerName ? `${result.message} ${this.lang.t('services.printerTargetSuffix', { printer: result.printerName })}` : result.message;
  }

  private describeUnknownError(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  private showPrintError(title: string, message: string, details?: string): void {
    this.appModal.openError(title, message, details);
  }
}
