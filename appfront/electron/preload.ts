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
  resolvePocketPay: (requestId: string, result: unknown) =>
    ipcRenderer.invoke('RoxPos:pocket-resolve-pay', requestId, result),
  resolvePocketHistory: (requestId: string, payload: unknown) =>
    ipcRenderer.invoke('RoxPos:pocket-resolve-history', requestId, payload),
  onPocketOrder: (listener: (order: unknown) => void) => {
    const handler = (_event: unknown, order: unknown): void => listener(order);
    ipcRenderer.on('RoxPos:pocket-order', handler);
    return () => ipcRenderer.removeListener('RoxPos:pocket-order', handler);
  },
  onPocketPay: (listener: (request: unknown) => void) => {
    const handler = (_event: unknown, request: unknown): void => listener(request);
    ipcRenderer.on('RoxPos:pocket-pay', handler);
    return () => ipcRenderer.removeListener('RoxPos:pocket-pay', handler);
  },
  onPocketHistory: (listener: (request: unknown) => void) => {
    const handler = (_event: unknown, request: unknown): void => listener(request);
    ipcRenderer.on('RoxPos:pocket-history', handler);
    return () => ipcRenderer.removeListener('RoxPos:pocket-history', handler);
  },
  onPocketStatus: (listener: (status: unknown) => void) => {
    const handler = (_event: unknown, status: unknown): void => listener(status);
    ipcRenderer.on('RoxPos:pocket-status', handler);
    return () => ipcRenderer.removeListener('RoxPos:pocket-status', handler);
  },
  getWsStatus: () => ipcRenderer.invoke('RoxPos:ws-get-status'),
  getWsConfig: () => ipcRenderer.invoke('RoxPos:ws-get-config'),
  setWsConfig: (patch: unknown) => ipcRenderer.invoke('RoxPos:ws-set-config', patch),
  connectWs: () => ipcRenderer.invoke('RoxPos:ws-connect'),
  disconnectWs: () => ipcRenderer.invoke('RoxPos:ws-disconnect'),
  pushWsCatalog: (catalog: unknown) => ipcRenderer.invoke('RoxPos:ws-push-catalog', catalog),
  getWsLogs: () => ipcRenderer.invoke('RoxPos:ws-get-logs'),
  resolveWsOrder: (eventId: string, result: unknown) =>
    ipcRenderer.invoke('RoxPos:ws-resolve-order', eventId, result),
  resolveWsSnapshot: (requestId: string, snapshot: unknown) =>
    ipcRenderer.invoke('RoxPos:ws-resolve-snapshot', requestId, snapshot),
  onWsStatus: (listener: (status: unknown) => void) => {
    const handler = (_event: unknown, status: unknown): void => listener(status);
    ipcRenderer.on('RoxPos:ws-status', handler);
    return () => ipcRenderer.removeListener('RoxPos:ws-status', handler);
  },
  onWsLog: (listener: (entry: unknown) => void) => {
    const handler = (_event: unknown, entry: unknown): void => listener(entry);
    ipcRenderer.on('RoxPos:ws-log', handler);
    return () => ipcRenderer.removeListener('RoxPos:ws-log', handler);
  },
  onWsOrder: (listener: (request: unknown) => void) => {
    const handler = (_event: unknown, request: unknown): void => listener(request);
    ipcRenderer.on('RoxPos:ws-order', handler);
    return () => ipcRenderer.removeListener('RoxPos:ws-order', handler);
  },
  onWsSnapshotRequest: (listener: (request: unknown) => void) => {
    const handler = (_event: unknown, request: unknown): void => listener(request);
    ipcRenderer.on('RoxPos:ws-snapshot-request', handler);
    return () => ipcRenderer.removeListener('RoxPos:ws-snapshot-request', handler);
  },
});
