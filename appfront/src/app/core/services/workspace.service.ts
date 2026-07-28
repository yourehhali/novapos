import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CompletedOrder,
  Category,
  DashboardSummary,
  PrinterConfig,
  Product,
  SyncStatus,
} from '../models/app.models';
import { NovaPosDbService } from '../../offline/novapos-db.service';
import { ApiService } from './api.service';
import { SessionService } from './session.service';
import {
  getOfflineDemoCatalog,
  getOfflineDemoDashboard,
  getOfflineDemoPrinters,
  getOfflineDemoSyncStatus,
  isOfflineDemoToken,
} from '../demo/offline-demo.data';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly db = inject(NovaPosDbService);
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);

  async loadCatalog(): Promise<{ products: Product[]; categories: Category[] }> {
    const token = this.session.accessToken();
    if (!token || isOfflineDemoToken(token)) {
      return this.loadCachedOrDemoCatalog();
    }

    try {
      const [products, categories] = await Promise.all([
        firstValueFrom(this.api.getProducts(token)),
        firstValueFrom(this.api.getCategories(token)),
      ]);

      await this.db.products.bulkPut(products);
      await this.db.categories.bulkPut(categories);

      return { products, categories };
    } catch {
      return this.loadCachedOrDemoCatalog();
    }
  }

  async loadDashboard(): Promise<DashboardSummary | null> {
    const token = this.session.accessToken();
    const branch = this.session.branch();

    if (!branch) {
      return null;
    }

    if (!token || isOfflineDemoToken(token)) {
      return this.loadComputedDashboard(branch.branchId);
    }

    try {
      const summary = await firstValueFrom(this.api.getDashboard(token, branch.branchId));
      await this.db.dashboard.put(summary);
      return this.buildComputedDashboard(branch.branchId, summary);
    } catch {
      return this.loadComputedDashboard(branch.branchId);
    }
  }

  async loadPrinters(): Promise<PrinterConfig[]> {
    const token = this.session.accessToken();
    if (!token || isOfflineDemoToken(token)) {
      return this.loadCachedOrDemoPrinters();
    }

    try {
      const printers = await firstValueFrom(this.api.getPrinters(token));
      await this.db.printers.bulkPut(printers);
      return printers;
    } catch {
      return this.loadCachedOrDemoPrinters();
    }
  }

  async loadSyncStatus(): Promise<SyncStatus | null> {
    const token = this.session.accessToken();
    const branch = this.session.branch();
    if (!branch) {
      return null;
    }

    if (!token || isOfflineDemoToken(token)) {
      return getOfflineDemoSyncStatus(branch.branchId, branch.deviceCode);
    }

    try {
      return await firstValueFrom(
        this.api.getSyncStatus(token, branch.branchId, branch.deviceCode),
      );
    } catch {
      return isOfflineDemoToken(token)
        ? getOfflineDemoSyncStatus(branch.branchId, branch.deviceCode)
        : null;
    }
  }

  private async loadCachedOrDemoCatalog(): Promise<{ products: Product[]; categories: Category[] }> {
    const [products, categories] = await Promise.all([
      this.db.products.toArray(),
      this.db.categories.toArray(),
    ]);

    if (products.length > 0 && categories.length > 0) {
      return { products, categories };
    }

    const demoCatalog = getOfflineDemoCatalog();
    await Promise.all([
      this.db.products.bulkPut(demoCatalog.products),
      this.db.categories.bulkPut(demoCatalog.categories),
    ]);

    return demoCatalog;
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
    const revenueToday = normalizedOrders
      .filter((order) => order.status === 'PAID')
      .filter((order) => this.isSameBusinessDay(order.paidAt ?? order.lastUpdatedAt ?? order.createdAt, branch.timezone))
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
    const printers = await this.db.printers.toArray();
    if (printers.length > 0) {
      return printers;
    }

    const demoPrinters = getOfflineDemoPrinters();
    await this.db.printers.bulkPut(demoPrinters);
    return demoPrinters;
  }
}
