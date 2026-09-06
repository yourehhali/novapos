import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject, filter, takeUntil } from 'rxjs';
import { CompletedOrder, DeliveryDriver, FloorTable, OrderChannel, PaymentMethod, SalesSummaryRange } from '../../core/models/app.models';
import { PosService } from '../../core/services/pos.service';
import { ReceiptService } from '../../core/services/receipt.service';
import { SalesSummaryService } from '../../core/services/sales-summary.service';
import { SessionService } from '../../core/services/session.service';
import { SyncService } from '../../core/services/sync.service';

const PAGE_SIZE = 12;

@Component({
  selector: 'app-order-history-page',
  templateUrl: './order-history-page.component.html',
  styleUrls: ['./order-history-page.component.scss'],
  standalone: false,
})
export class OrderHistoryPageComponent implements OnInit, OnDestroy {
  private readonly posService = inject(PosService);
  private readonly receiptService = inject(ReceiptService);
  private readonly salesSummaryService = inject(SalesSummaryService);
  private readonly session = inject(SessionService);
  private readonly syncService = inject(SyncService);
  private readonly router = inject(Router);

  protected readonly PAGE_SIZE = PAGE_SIZE;
  protected readonly allOrders = signal<CompletedOrder[]>([]);
  protected readonly floorTables = signal<FloorTable[]>([]);
  protected readonly deliveryDrivers = signal<DeliveryDriver[]>([]);
  protected readonly paymentMethods = signal<Record<string, 'CASH' | 'CARD'>>({});
  protected readonly printingSummary = signal(false);
  protected readonly lastSummaryPrintedAt = signal<string | null>(null);
  protected readonly activeTab = signal<'PREPARED' | 'PAID'>('PREPARED');
  protected readonly page = signal(1);

  protected readonly filterChannel = signal<'ALL' | OrderChannel>('ALL');
  protected readonly filterTableNumber = signal<string>('');
  protected readonly filterLivreurId = signal<string>('');

  protected readonly preparedOrders = computed(() =>
    this.allOrders().filter((o) => o.status === 'PREPARED'),
  );
  protected readonly paidOrders = computed(() =>
    this.allOrders().filter((o) => o.status === 'PAID'),
  );

  protected readonly activeOrders = computed(() =>
    this.activeTab() === 'PREPARED' ? this.preparedOrders() : this.paidOrders(),
  );

  protected readonly filteredActiveOrders = computed(() => {
    const list = this.activeOrders();
    const channel = this.filterChannel();
    const tableNumber = this.filterTableNumber();
    const livreurId = this.filterLivreurId();
    return list.filter((o) => {
      if (channel !== 'ALL' && o.channel !== channel) return false;
      if (tableNumber && (!o.tableNumber || o.tableNumber !== tableNumber)) return false;
      if (livreurId && (!o.livreurId || o.livreurId !== livreurId)) return false;
      return true;
    });
  });

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredActiveOrders().length / PAGE_SIZE)),
  );

  protected readonly paginatedOrders = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.filteredActiveOrders().slice(start, start + PAGE_SIZE);
  });

  protected readonly filterCounts = computed(() => {
    const base = this.activeOrders();
    return {
      all: base.length,
      surPlace: base.filter((o) => (o.channel || 'SUR_PLACE') === 'SUR_PLACE').length,
      emporter: base.filter((o) => o.channel === 'EMPORTER').length,
      livraison: base.filter((o) => o.channel === 'LIVRAISON').length,
    };
  });

  private readonly destroy$ = new Subject<void>();

  async ngOnInit(): Promise<void> {
    await this.reloadAll();

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$),
      )
      .subscribe(async (event) => {
        if ((event as NavigationEnd).urlAfterRedirects.startsWith('/order-history')) {
          await this.reloadAll();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected switchTab(tab: 'PREPARED' | 'PAID'): void {
    this.activeTab.set(tab);
    this.page.set(1);
  }

  protected setFilterChannel(value: 'ALL' | OrderChannel): void {
    this.filterChannel.set(value);
    if (value !== 'SUR_PLACE') this.filterTableNumber.set('');
    if (value !== 'LIVRAISON') this.filterLivreurId.set('');
    this.page.set(1);
  }

  protected setFilterTableNumber(value: string): void {
    this.filterTableNumber.set(value);
    this.page.set(1);
  }

  protected setFilterLivreurId(value: string): void {
    this.filterLivreurId.set(value);
    this.page.set(1);
  }

  protected clearFilters(): void {
    this.filterChannel.set('ALL');
    this.filterTableNumber.set('');
    this.filterLivreurId.set('');
    this.page.set(1);
  }

  protected hasActiveFilters(): boolean {
    return (
      this.filterChannel() !== 'ALL' ||
      this.filterTableNumber() !== '' ||
      this.filterLivreurId() !== ''
    );
  }

  protected goToPage(page: number): void {
    const clamped = Math.min(Math.max(1, page), this.totalPages());
    this.page.set(clamped);
  }

  protected pageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.page();
    const pages: number[] = [];
    const window = 2;
    const start = Math.max(1, current - window);
    const end = Math.min(total, current + window);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  protected visibleLines(order: CompletedOrder) {
    return order.lines.slice(0, 5);
  }

  protected orderIndex(orderNumber: string): string {
    return orderNumber.split('-').pop()?.slice(-2) ?? '00';
  }

  protected channelLabel(order: CompletedOrder): string {
    const ch = order.channel;
    if (ch === 'EMPORTER') return 'A emporter';
    if (ch === 'LIVRAISON') return 'Livraison';
    return order.tableNumber ? `Table ${order.tableNumber}` : 'Sur place';
  }

  protected channelBadgeClass(order: CompletedOrder): 'surplace' | 'emporter' | 'livraison' {
    const ch = order.channel;
    if (ch === 'EMPORTER') return 'emporter';
    if (ch === 'LIVRAISON') return 'livraison';
    return 'surplace';
  }

  protected livreurLabel(order: CompletedOrder): string {
    if (!order.livreurId) return '';
    const driver = this.deliveryDrivers().find((d) => d.id === order.livreurId);
    if (!driver) return 'Livreur inconnu';
    return `Livreur N°${driver.number} - ${driver.name}`;
  }

  protected statusLabel(status: string): string {
    return status === 'PAID' ? 'Paye' : 'Prepare';
  }

  protected paymentMethodFor(orderId: string): 'CASH' | 'CARD' {
    return this.paymentMethods()[orderId] ?? 'CASH';
  }

  protected setPaymentMethod(orderId: string, method: PaymentMethod): void {
    if (method !== 'CASH' && method !== 'CARD') {
      return;
    }

    this.paymentMethods.set({
      ...this.paymentMethods(),
      [orderId]: method,
    });
  }

  protected async reprint(order: CompletedOrder): Promise<void> {
    await this.receiptService.printPaymentTicket(order);
  }

  protected async modify(orderId: string): Promise<void> {
    await this.posService.reopenPreparedOrder(orderId);
  }

  protected async pay(orderId: string): Promise<void> {
    const updatedOrder = await this.posService.payPreparedOrder(orderId, this.paymentMethodFor(orderId));
    if (!updatedOrder) {
      return;
    }

    await this.receiptService.printPaymentTicket(updatedOrder);
    this.syncService.scheduleSync(100);
    await this.reloadAll();
  }

  protected async printSalesSummary(range: SalesSummaryRange): Promise<void> {
    this.printingSummary.set(true);

    try {
      const report = await this.salesSummaryService.buildReport(range);
      if (!report) {
        return;
      }

      const printed = await this.receiptService.printSalesSummary(report);
      if (printed) {
        await this.salesSummaryService.markPrinted(report);
        this.lastSummaryPrintedAt.set(report.generatedAt);
      }
    } finally {
      this.printingSummary.set(false);
    }
  }

  protected summaryPrintedLabel(): string {
    const lastPrintedAt = this.lastSummaryPrintedAt();
    if (!lastPrintedAt) {
      return 'Aucun total precedent imprime';
    }

    return `Dernier total imprime a ${new Date(lastPrintedAt).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  private async reloadAll(): Promise<void> {
    await Promise.all([
      this.reloadOrders(),
      this.reloadTables(),
      this.reloadDrivers(),
      this.refreshLastSummaryPrintedAt(),
    ]);
  }

  private async reloadTables(): Promise<void> {
    try {
      const tables = await this.posService.listFloorTables();
      this.floorTables.set(tables);
    } catch {
      this.floorTables.set([]);
    }
  }

  private async reloadDrivers(): Promise<void> {
    try {
      const drivers = await this.posService.listDeliveryDrivers();
      this.deliveryDrivers.set(drivers);
    } catch {
      this.deliveryDrivers.set([]);
    }
  }

  private async reloadOrders(): Promise<void> {
    const orders = await this.posService.listCompletedOrders(this.session.branch()?.branchId);
    this.allOrders.set(orders);

    const paymentMethods: Record<string, 'CASH' | 'CARD'> = {};
    for (const order of orders) {
      paymentMethods[order.id] = order.paymentMethod === 'CARD' ? 'CARD' : 'CASH';
    }
    this.paymentMethods.set(paymentMethods);

    if (this.page() > this.totalPages()) {
      this.page.set(1);
    }
  }

  private async refreshLastSummaryPrintedAt(): Promise<void> {
    this.lastSummaryPrintedAt.set(await this.salesSummaryService.getLastPrintedAt());
  }
}
