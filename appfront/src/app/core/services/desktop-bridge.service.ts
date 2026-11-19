import { Injectable } from '@angular/core';
import {
  DesktopPrinterInfo,
  DesktopRuntimeInfo,
  PocketCatalogPayload,
  PocketIncomingOrder,
  PocketOrderResult,
  PocketServerStatus,
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

    if (typeof window.RoxPosDesktop !== 'undefined') {
      return true;
    }

    return /Electron/i.test(window.navigator.userAgent);
  }

  async getRuntimeInfo(): Promise<DesktopRuntimeInfo | null> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return null;
    }

    return bridge.getRuntimeInfo();
  }

  async listPrinters(): Promise<DesktopPrinterInfo[]> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return [];
    }

    return bridge.listPrinters();
  }

  async printTicket(request: PrintTicketRequest): Promise<PrintTicketResult | null> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return null;
    }

    return bridge.printTicket(request);
  }

  async printSalesSummary(request: PrintSalesSummaryRequest): Promise<PrintTicketResult | null> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return null;
    }

    return bridge.printSalesSummary(request);
  }

  async getPocketStatus(): Promise<PocketServerStatus | null> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return null;
    }

    return bridge.getPocketStatus();
  }

  async startPocketServer(): Promise<PocketServerStatus | null> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return null;
    }

    return bridge.startPocketServer();
  }

  async stopPocketServer(): Promise<PocketServerStatus | null> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return null;
    }

    return bridge.stopPocketServer();
  }

  async regeneratePocketPin(): Promise<PocketServerStatus | null> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return null;
    }

    return bridge.regeneratePocketPin();
  }

  async pushPocketData(payload: PocketCatalogPayload): Promise<void> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return;
    }

    await bridge.pushPocketData(payload);
  }

  async resolvePocketOrder(requestId: string, result: PocketOrderResult): Promise<void> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return;
    }

    await bridge.resolvePocketOrder(requestId, result);
  }

  onPocketOrder(listener: (order: PocketIncomingOrder) => void): () => void {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return () => undefined;
    }

    return bridge.onPocketOrder(listener);
  }

  onPocketStatus(listener: (status: PocketServerStatus) => void): () => void {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return () => undefined;
    }

    return bridge.onPocketStatus(listener);
  }
}
