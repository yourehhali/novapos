import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('novaPosDesktop', {
  getRuntimeInfo: () => ipcRenderer.invoke('novapos:desktop-info'),
  listPrinters: () => ipcRenderer.invoke('novapos:list-printers'),
  printTicket: (request: unknown) => ipcRenderer.invoke('novapos:print-ticket', request),
  printSalesSummary: (request: unknown) => ipcRenderer.invoke('novapos:print-sales-summary', request),
});
