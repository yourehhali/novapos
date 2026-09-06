import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import {
  BusinessSettings,
  CompletedOrder,
  Category,
  DashboardSummary,
  DemoSeedingMode,
  PrinterConfig,
  Product,
  SyncStatus,
} from '../models/app.models';
import { NovaPosDbService } from '../../offline/novapos-db.service';
import { ApiService } from './api.service';
import { SessionService } from './session.service';
import { BusinessSettingsService, DEFAULT_BUSINESS_SETTINGS } from './business-settings.service';
import {
  getOfflineDemoCatalog,
  getOfflineDemoDashboard,
  getOfflineDemoPrinters,
  getOfflineDemoSyncStatus,
  isOfflineDemoToken,
} from '../demo/offline-demo.data';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private static readonly API_TIMEOUT_MS = 1200;
  private readonly db = inject(NovaPosDbService);
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly businessSettings = inject(BusinessSettingsService);
  private catalogCache: { products: Product[]; categories: Category[] } | null = null;
  private printersCache: PrinterConfig[] | null = null;

  invalidateAllCaches(): void {
    this.catalogCache = null;
    this.printersCache = null;
  }

  async loadCatalog(): Promise<{ products: Product[]; categories: Category[] }> {
    const token = this.session.accessToken();
    const shouldForceDemoCatalog = !token || isOfflineDemoToken(token);
    const cachedCatalog = await this.loadCachedOrDemoCatalog(shouldForceDemoCatalog);

    if (shouldForceDemoCatalog) {
      return cachedCatalog;
    }

    if (cachedCatalog.products.length > 0 && cachedCatalog.categories.length > 0) {
      if (token) {
        void this.refreshCatalogFromApi(token);
      }
      return cachedCatalog;
    }

    return this.refreshCatalogFromApi(token);
  }

  async loadDashboard(): Promise<DashboardSummary | null> {
    const branch = this.session.branch();

    if (!branch) {
      return null;
    }

    const computedSummary = await this.loadComputedDashboard(branch.branchId);
    if (this.session.accessToken() && !isOfflineDemoToken(this.session.accessToken())) {
      void this.refreshDashboardFromApi(branch.branchId, this.session.accessToken()!);
    }
    return computedSummary;
  }

  async loadPrinters(): Promise<PrinterConfig[]> {
    const token = this.session.accessToken();
    const cachedPrinters = await this.loadCachedOrDemoPrinters();
    if (cachedPrinters.length > 0) {
      if (token && !isOfflineDemoToken(token)) {
        void this.refreshPrintersFromApi(token);
      }
      return cachedPrinters;
    }

    if (!token || isOfflineDemoToken(token)) {
      return cachedPrinters;
    }

    return this.refreshPrintersFromApi(token);
  }

  async loadSyncStatus(): Promise<SyncStatus | null> {
    const token = this.session.accessToken();
    const branch = this.session.branch();
    if (!branch) {
      return null;
    }

    const localStatus = await this.buildLocalSyncStatus(
      branch.branchId,
      branch.deviceCode,
      undefined,
    );

    if (!token || isOfflineDemoToken(token)) {
      return localStatus ?? getOfflineDemoSyncStatus(branch.branchId, branch.deviceCode);
    }

    void this.refreshSyncStatusFromApi(token, branch.branchId, branch.deviceCode);
    return localStatus;
  }

  private async loadCachedOrDemoCatalog(
    forceDemoCatalog = false,
  ): Promise<{ products: Product[]; categories: Category[] }> {
    const settings = this.businessSettings.snapshot() ?? await this.businessSettings.load();
    const seedingMode: DemoSeedingMode = settings?.demoSeedingMode ?? DEFAULT_BUSINESS_SETTINGS.demoSeedingMode;
    const demoCatalog = this.normalizeCatalog(getOfflineDemoCatalog());

    if (forceDemoCatalog && seedingMode === 'DEMO') {
      return this.persistCatalog(demoCatalog);
    }

    if (this.catalogCache) {
      return this.catalogCache;
    }

    const [products, categories] = await Promise.all([
      this.db.products.toArray(),
      this.db.categories.toArray(),
    ]);

    if (products.length > 0 && categories.length > 0) {
      const cachedCatalog = this.normalizeCatalog({ products, categories });
      if (this.hasExpectedCategoryStructure(cachedCatalog, demoCatalog)) {
        this.catalogCache = cachedCatalog;
        return this.catalogCache;
      }
      if (seedingMode === 'DEMO') {
        return this.persistCatalog(demoCatalog);
      }
      this.catalogCache = cachedCatalog;
      return this.catalogCache;
    }

    if (seedingMode === 'DEMO') {
      return this.persistCatalog(demoCatalog);
    }
    const cachedCatalog = { products: products.slice(), categories: categories.slice() };
    this.catalogCache = cachedCatalog;
    return cachedCatalog;
  }

  private normalizeCatalog(catalog: {
    products: Product[];
    categories: Category[];
  }): { products: Product[]; categories: Category[] } {
    const orderedCategories = [...catalog.categories];
    const categoryOrder = new Map(
      getOfflineDemoCatalog().categories.map((category, index) => [category.id, index]),
    );
    orderedCategories.sort(
      (left, right) => (categoryOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER)
        - (categoryOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    );

    return {
      products: [...catalog.products],
      categories: orderedCategories,
    };
  }

  private hasExpectedCategoryStructure(
    candidateCatalog: { products: Product[]; categories: Category[] },
    expectedCatalog: { products: Product[]; categories: Category[] },
  ): boolean {
    if (candidateCatalog.categories.length !== expectedCatalog.categories.length) {
      return false;
    }

    return expectedCatalog.categories.every((category, index) => {
      const candidate = candidateCatalog.categories[index];
      return candidate?.id === category.id && candidate?.name === category.name;
    });
  }

  private async persistCatalog(catalog: {
    products: Product[];
    categories: Category[];
  }): Promise<{ products: Product[]; categories: Category[] }> {
    await this.db.transaction('rw', this.db.products, this.db.categories, async () => {
      await this.db.products.clear();
      await this.db.categories.clear();
      await this.db.products.bulkPut(catalog.products);
      await this.db.categories.bulkPut(catalog.categories);
    });

    this.catalogCache = this.normalizeCatalog(catalog);
    return this.catalogCache;
  }

  private async loadComputedDashboard(branchId: string): Promise<DashboardSummary | null> {
    const cached = await this.db.dashboard.get(branchId);
    return this.buildComputedDashboard(branchId, cached ?? getOfflineDemoDashboard(branchId) ?? undefined);
  }

  private async buildComputedDashboard(
    branchId: string,
    baseSummary?: DashboardSummary,
  ): Promise<DashboardSummary | null> {
    const branch = this.session.branch();
    if (!branch) {
      return null;
    }

    const [orders, queue] = await Promise.all([
      this.db.completedOrders.where('branchId').equals(branchId).toArray(),
      this.db.eventQueue.where('branchId').equals(branchId).toArray(),
    ]);

    const normalizedOrders = orders.map((order) => this.normalizeOrder(order));
    const pendingQueue = queue.filter((entry) => entry.localStatus === 'pending');
    const activeOrders = normalizedOrders.filter((order) => order.status === 'PREPARED').length;
    const paidToday = normalizedOrders
      .filter((order) => order.status === 'PAID')
      .filter((order) => this.isSameBusinessDay(order.paidAt ?? order.lastUpdatedAt ?? order.createdAt, branch.timezone));
    const revenueToday = paidToday.reduce((sum, order) => sum + order.total, 0);
    const revenueCashToday = paidToday
      .filter((order) => order.paymentMethod === 'CASH')
      .reduce((sum, order) => sum + order.total, 0);
    const revenueCardToday = paidToday
      .filter((order) => order.paymentMethod === 'CARD')
      .reduce((sum, order) => sum + order.total, 0);
    const lastSuccessfulSyncAt = baseSummary?.lastSuccessfulSyncAt ?? 'En attente';

    const operationalNotes = [
      pendingQueue.length > 0
        ? `${pendingQueue.length} evenements attendent encore la synchronisation`
        : 'La file locale est synchronisee sur cet appareil',
      `${activeOrders} commande(s) preparee(s) en attente de paiement`,
      `${normalizedOrders.filter((order) => order.status === 'PAID').length} commande(s) payee(s) conservees localement`,
    ];

    const computedSummary: DashboardSummary = {
      businessName: branch.businessName,
      branchId,
      activeOrders,
      revenueToday,
      revenueCashToday,
      revenueCardToday,
      localQueueDepth: pendingQueue.length,
      lastSuccessfulSyncAt,
      operationalNotes,
    };

    await this.db.dashboard.put(computedSummary);
    return computedSummary;
  }

  private normalizeOrder(order: CompletedOrder): CompletedOrder {
    const paymentMethod = order.paymentMethod === 'CARD' || order.paymentMethod === 'CASH'
      ? order.paymentMethod
      : 'UNPAID';
    const status = order.status ?? (paymentMethod === 'UNPAID' ? 'PREPARED' : 'PAID');
    const createdAt = order.createdAt ?? new Date().toISOString();

    return {
      ...order,
      paymentMethod,
      status,
      lastUpdatedAt: order.lastUpdatedAt ?? order.paidAt ?? order.kitchenPrintedAt ?? createdAt,
      version: order.version ?? (status === 'PAID' ? 3 : 2),
      createdAt,
    };
  }

  private isSameBusinessDay(value: string, timeZone: string): boolean {
    return this.dayKey(value, timeZone) === this.dayKey(new Date().toISOString(), timeZone);
  }

  private dayKey(value: string, timeZone: string): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    return formatter.format(new Date(value));
  }

  private async loadCachedOrDemoPrinters(): Promise<PrinterConfig[]> {
    if (this.printersCache) {
      return this.printersCache;
    }

    const printers = await this.db.printers.toArray();
    if (printers.length > 0) {
      this.printersCache = printers;
      return printers;
    }

    const settings = this.businessSettings.snapshot() ?? await this.businessSettings.load();
    const seedingMode = settings?.demoSeedingMode ?? DEFAULT_BUSINESS_SETTINGS.demoSeedingMode;
    if (seedingMode === 'BLANK') {
      this.printersCache = [];
      return [];
    }

    const demoPrinters = getOfflineDemoPrinters();
    await this.db.printers.bulkPut(demoPrinters);
    this.printersCache = demoPrinters;
    return demoPrinters;
  }

  private async refreshCatalogFromApi(
    token: string,
  ): Promise<{ products: Product[]; categories: Category[] }> {
    try {
      const [products, categories] = await Promise.all([
        firstValueFrom(this.api.getProducts(token).pipe(timeout(WorkspaceService.API_TIMEOUT_MS))),
        firstValueFrom(this.api.getCategories(token).pipe(timeout(WorkspaceService.API_TIMEOUT_MS))),
      ]);

      if (products.length === 0 || categories.length === 0) {
        return this.loadCachedOrDemoCatalog();
      }

      const normalizedCatalog = this.normalizeCatalog({ products, categories });
      await this.db.transaction('rw', this.db.products, this.db.categories, async () => {
        await this.db.products.clear();
        await this.db.categories.clear();
        await this.db.products.bulkPut(normalizedCatalog.products);
        await this.db.categories.bulkPut(normalizedCatalog.categories);
      });

      this.catalogCache = normalizedCatalog;
      return this.catalogCache;
    } catch {
      return this.loadCachedOrDemoCatalog();
    }
  }

  private async refreshDashboardFromApi(token: string, branchId: string): Promise<void> {
    try {
      const summary = await firstValueFrom(
        this.api.getDashboard(token, branchId).pipe(timeout(WorkspaceService.API_TIMEOUT_MS)),
      );
      await this.db.dashboard.put(summary);
      await this.buildComputedDashboard(branchId, summary);
    } catch {
      // Keep the locally computed dashboard when the backend is slow or unavailable.
    }
  }

  private async refreshPrintersFromApi(token: string): Promise<PrinterConfig[]> {
    try {
      const printers = await firstValueFrom(
        this.api.getPrinters(token).pipe(timeout(WorkspaceService.API_TIMEOUT_MS)),
      );
      if (printers.length === 0) {
        return this.loadCachedOrDemoPrinters();
      }

      await this.db.printers.bulkPut(printers);
      this.printersCache = printers;
      return printers;
    } catch {
      return this.loadCachedOrDemoPrinters();
    }
  }

  private async buildLocalSyncStatus(
    branchId: string,
    deviceId: string,
    remoteStatus?: SyncStatus,
  ): Promise<SyncStatus> {
    const queue = await this.db.eventQueue.where('branchId').equals(branchId).toArray();
    const branchQueue = queue.filter((entry) => entry.deviceId === deviceId);
    const acknowledgedEvents = branchQueue.filter((entry) => entry.localStatus === 'acknowledged').length;
    const pendingConflicts = branchQueue.filter((entry) => entry.localStatus === 'conflict').length;
    const lastCursor = await this.db.syncCursors.get(deviceId);

    return {
      branchId,
      deviceId,
      acceptedEvents: remoteStatus?.acceptedEvents ?? acknowledgedEvents,
      duplicateEvents: remoteStatus?.duplicateEvents ?? 0,
      pendingConflicts,
      serverCursor: remoteStatus?.serverCursor ?? lastCursor?.cursor ?? 'LOCAL_ONLY',
    };
  }

  private async refreshSyncStatusFromApi(
    token: string,
    branchId: string,
    deviceId: string,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.api.getSyncStatus(token, branchId, deviceId).pipe(timeout(WorkspaceService.API_TIMEOUT_MS)),
      );
    } catch {
      // Keep the local sync view when the API is slow or unavailable.
    }
  }

  private syncStatusKey(branchId: string, deviceId: string): string {
    return `${branchId}:${deviceId}`;
  }

  async wipeAllLocalData(mode: DemoSeedingMode): Promise<void> {
    const db = this.db;
    const session = this.session;

    const tablesToClear = [
      db.products,
      db.categories,
      db.floorTables,
      db.deliveryDrivers,
      db.completedOrders,
      db.eventQueue,
      db.syncCursors,
      db.reportPrintStates,
      db.dashboard,
      db.cashOpenings,
      db.sessionContext,
      db.bootstrapSessions,
      db.printers,
    ].filter((tbl) => Boolean(tbl)) as any[];

    const storeArgs: any[] = [...tablesToClear, db.businessSettings];
    await db.transaction('rw', storeArgs, async () => {
      for (const tbl of tablesToClear) {
        try { await tbl.clear(); } catch { /* swallow */ }
      }

      if (mode === 'DEMO') {
        const catalog = this.normalizeCatalog(getOfflineDemoCatalog());
        await db.products.bulkPut(catalog.products);
        await db.categories.bulkPut(catalog.categories);
        try { await db.printers.bulkPut(getOfflineDemoPrinters()); } catch { /* swallow */ }
      }

      session.clear();
      try { sessionStorage.clear(); } catch { /* swallow */ }

      const existingSettings = (await db.businessSettings.get('current')) ?? {} as Partial<BusinessSettings>;
      const nextSettings: BusinessSettings = {
        ...DEFAULT_BUSINESS_SETTINGS,
        ...existingSettings,
        demoSeedingMode: mode,
        updatedAt: new Date().toISOString(),
      };
      await db.businessSettings.put(nextSettings);
    });

    this.invalidateAllCaches();
  }
}
