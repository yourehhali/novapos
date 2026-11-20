import { Injectable } from '@angular/core';
import {
  DesktopPrinterInfo,
  DesktopRuntimeInfo,
  PocketCatalogPayload,
  PocketHistoryPayload,
  PocketHistoryRequest,
  PocketIncomingOrder,
  PocketOrderResult,
  PocketPayRequest,
  PocketPayResult,
  PocketServerStatus,
  PosWsCatalogPayload,
  PosWsClientStatus,
  PosWsConfigPatch,
  PosWsConfigView,
  PosWsIncomingOrder,
  PosWsLogEntry,
  PosWsOrderResultPayload,
  PosWsSnapshot,
  PosWsSnapshotRequest,
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

  async quitApp(): Promise<void> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return;
    }

    await bridge.quitApp();
  }

  async resolvePocketOrder(requestId: string, result: PocketOrderResult): Promise<void> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return;
    }

    await bridge.resolvePocketOrder(requestId, result);
  }

  async resolvePocketPay(requestId: string, result: PocketPayResult): Promise<void> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return;
    }

    await bridge.resolvePocketPay(requestId, result);
  }

  async resolvePocketHistory(requestId: string, payload: PocketHistoryPayload): Promise<void> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return;
    }

    await bridge.resolvePocketHistory(requestId, payload);
  }

  onPocketOrder(listener: (order: PocketIncomingOrder) => void): () => void {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return () => undefined;
    }

    return bridge.onPocketOrder(listener);
  }

  onPocketPay(listener: (request: PocketPayRequest) => void): () => void {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return () => undefined;
    }

    return bridge.onPocketPay(listener);
  }

  onPocketHistory(listener: (request: PocketHistoryRequest) => void): () => void {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return () => undefined;
    }

    return bridge.onPocketHistory(listener);
  }

  onPocketStatus(listener: (status: PocketServerStatus) => void): () => void {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return () => undefined;
    }

    return bridge.onPocketStatus(listener);
  }

  async getWsStatus(): Promise<PosWsClientStatus | null> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return null;
    }

    return bridge.getWsStatus();
  }

  async getWsConfig(): Promise<PosWsConfigView | null> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return null;
    }

    return bridge.getWsConfig();
  }

  async setWsConfig(patch: PosWsConfigPatch): Promise<PosWsClientStatus | null> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return null;
    }

    return bridge.setWsConfig(patch);
  }

  async connectWs(): Promise<PosWsClientStatus | null> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return null;
    }

    return bridge.connectWs();
  }

  async disconnectWs(): Promise<PosWsClientStatus | null> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return null;
    }

    return bridge.disconnectWs();
  }

  async pushWsCatalog(catalog: PosWsCatalogPayload): Promise<void> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return;
    }

    await bridge.pushWsCatalog(catalog);
  }

  async getWsLogs(): Promise<PosWsLogEntry[]> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return [];
    }

    return bridge.getWsLogs();
  }

  async resolveWsOrder(eventId: string, result: PosWsOrderResultPayload): Promise<void> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return;
    }

    await bridge.resolveWsOrder(eventId, result);
  }

  async resolveWsSnapshot(requestId: string, snapshot: PosWsSnapshot): Promise<void> {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return;
    }

    await bridge.resolveWsSnapshot(requestId, snapshot);
  }

  onWsStatus(listener: (status: PosWsClientStatus) => void): () => void {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return () => undefined;
    }

    return bridge.onWsStatus(listener);
  }

  onWsLog(listener: (entry: PosWsLogEntry) => void): () => void {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return () => undefined;
    }

    return bridge.onWsLog(listener);
  }

  onWsOrder(listener: (request: PosWsIncomingOrder) => void): () => void {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return () => undefined;
    }

    return bridge.onWsOrder(listener);
  }

  onWsSnapshotRequest(listener: (request: PosWsSnapshotRequest) => void): () => void {
    const bridge = window.RoxPosDesktop;
    if (!bridge) {
      return () => undefined;
    }

    return bridge.onWsSnapshotRequest(listener);
  }
}
