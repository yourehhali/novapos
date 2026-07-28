import {
  DesktopPrinterInfo,
  DesktopRuntimeInfo,
  PrintSalesSummaryRequest,
  PrintTicketRequest,
  PrintTicketResult,
} from './app/core/models/app.models';

declare global {
  interface Window {
    novaPosDesktop?: {
      getRuntimeInfo(): Promise<DesktopRuntimeInfo>;
      listPrinters(): Promise<DesktopPrinterInfo[]>;
      printTicket(request: PrintTicketRequest): Promise<PrintTicketResult>;
      printSalesSummary(request: PrintSalesSummaryRequest): Promise<PrintTicketResult>;
    };
  }
}

export {};
