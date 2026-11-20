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
} from './app/core/models/app.models';

declare global {
  interface Window {
    RoxPosDesktop?: {
      getRuntimeInfo(): Promise<DesktopRuntimeInfo>;
      listPrinters(): Promise<DesktopPrinterInfo[]>;
      printTicket(request: PrintTicketRequest): Promise<PrintTicketResult>;
      printSalesSummary(request: PrintSalesSummaryRequest): Promise<PrintTicketResult>;
      startPocketServer(): Promise<PocketServerStatus>;
      stopPocketServer(): Promise<PocketServerStatus>;
      getPocketStatus(): Promise<PocketServerStatus>;
      regeneratePocketPin(): Promise<PocketServerStatus>;
      pushPocketData(payload: PocketCatalogPayload): Promise<{ ok: boolean }>;
      quitApp(): Promise<void>;
      resolvePocketOrder(requestId: string, result: PocketOrderResult): Promise<{ ok: boolean }>;
      resolvePocketPay(requestId: string, result: PocketPayResult): Promise<{ ok: boolean }>;
      resolvePocketHistory(requestId: string, payload: PocketHistoryPayload): Promise<{ ok: boolean }>;
      onPocketOrder(listener: (order: PocketIncomingOrder) => void): () => void;
      onPocketPay(listener: (request: PocketPayRequest) => void): () => void;
      onPocketHistory(listener: (request: PocketHistoryRequest) => void): () => void;
      onPocketStatus(listener: (status: PocketServerStatus) => void): () => void;
      getWsStatus(): Promise<PosWsClientStatus>;
      getWsConfig(): Promise<PosWsConfigView>;
      setWsConfig(patch: PosWsConfigPatch): Promise<PosWsClientStatus>;
      connectWs(): Promise<PosWsClientStatus>;
      disconnectWs(): Promise<PosWsClientStatus>;
      pushWsCatalog(catalog: PosWsCatalogPayload): Promise<{ ok: boolean }>;
      getWsLogs(): Promise<PosWsLogEntry[]>;
      resolveWsOrder(eventId: string, result: PosWsOrderResultPayload): Promise<{ ok: boolean }>;
      resolveWsSnapshot(requestId: string, snapshot: PosWsSnapshot): Promise<{ ok: boolean }>;
      onWsStatus(listener: (status: PosWsClientStatus) => void): () => void;
      onWsLog(listener: (entry: PosWsLogEntry) => void): () => void;
      onWsOrder(listener: (request: PosWsIncomingOrder) => void): () => void;
      onWsSnapshotRequest(listener: (request: PosWsSnapshotRequest) => void): () => void;
    };
  }
}

export {};
