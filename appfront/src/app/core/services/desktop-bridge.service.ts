import { Injectable } from '@angular/core';
import {
  DesktopPrinterInfo,
  DesktopRuntimeInfo,
  PrintSalesSummaryRequest,
  PrintTicketRequest,
  PrintTicketResult,
} from '../models/app.models';

@Injectable({ providedIn: 'root' })
export class DesktopBridgeService {
  isDesktop(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    if (typeof window.novaPosDesktop !== 'undefined') {
      return true;
    }

    return /Electron/i.test(window.navigator.userAgent);
  }

  async getRuntimeInfo(): Promise<DesktopRuntimeInfo | null> {
    const bridge = window.novaPosDesktop;
    if (!bridge) {
      return null;
    }

    return bridge.getRuntimeInfo();
  }

  async listPrinters(): Promise<DesktopPrinterInfo[]> {
    const bridge = window.novaPosDesktop;
    if (!bridge) {
      return [];
    }

    return bridge.listPrinters();
  }

  async printTicket(request: PrintTicketRequest): Promise<PrintTicketResult | null> {
    const bridge = window.novaPosDesktop;
    if (!bridge) {
      return null;
    }

    return bridge.printTicket(request);
  }

  async printSalesSummary(request: PrintSalesSummaryRequest): Promise<PrintTicketResult | null> {
    const bridge = window.novaPosDesktop;
    if (!bridge) {
      return null;
    }

    return bridge.printSalesSummary(request);
  }
}
