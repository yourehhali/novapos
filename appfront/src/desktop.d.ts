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
      onPocketOrder(listener: (order: PocketIncomingOrder) => void): () => void;
      onPocketStatus(listener: (status: PocketServerStatus) => void): () => void;
    };
  }
}

export {};
