import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('RoxPosDesktop', {
  getRuntimeInfo: () => ipcRenderer.invoke('RoxPos:desktop-info'),
  listPrinters: () => ipcRenderer.invoke('RoxPos:list-printers'),
  printTicket: (request: unknown) => ipcRenderer.invoke('RoxPos:print-ticket', request),
  printSalesSummary: (request: unknown) => ipcRenderer.invoke('RoxPos:print-sales-summary', request),
  startPocketServer: () => ipcRenderer.invoke('RoxPos:pocket-start'),
  stopPocketServer: () => ipcRenderer.invoke('RoxPos:pocket-stop'),
  getPocketStatus: () => ipcRenderer.invoke('RoxPos:pocket-status'),
  regeneratePocketPin: () => ipcRenderer.invoke('RoxPos:pocket-regenerate-pin'),
  pushPocketData: (payload: unknown) => ipcRenderer.invoke('RoxPos:pocket-push-data', payload),
  quitApp: () => ipcRenderer.invoke('RoxPos:quit-app'),
  resolvePocketOrder: (requestId: string, result: unknown) =>
    ipcRenderer.invoke('RoxPos:pocket-resolve-order', requestId, result),
  onPocketOrder: (listener: (order: unknown) => void) => {
    const handler = (_event: unknown, order: unknown): void => listener(order);
    ipcRenderer.on('RoxPos:pocket-order', handler);
    return () => ipcRenderer.removeListener('RoxPos:pocket-order', handler);
  },
  onPocketStatus: (listener: (status: unknown) => void) => {
    const handler = (_event: unknown, status: unknown): void => listener(status);
    ipcRenderer.on('RoxPos:pocket-status', handler);
    return () => ipcRenderer.removeListener('RoxPos:pocket-status', handler);
  },
});
