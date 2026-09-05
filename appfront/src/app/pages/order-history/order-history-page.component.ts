import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject, filter, takeUntil } from 'rxjs';
import { CompletedOrder, PaymentMethod, SalesSummaryRange } from '../../core/models/app.models';
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
  protected readonly paymentMethods = signal<Record<string, 'CASH' | 'CARD'>>({});
  protected readonly printingSummary = signal(false);
  protected readonly lastSummaryPrintedAt = signal<string | null>(null);
  protected readonly activeTab = signal<'PREPARED' | 'PAID'>('PREPARED');
  protected readonly page = signal(1);

  protected readonly preparedOrders = computed(() =>
    this.allOrders().filter((o) => o.status === 'PREPARED'),
  );
  protected readonly paidOrders = computed(() =>
    this.allOrders().filter((o) => o.status === 'PAID'),
  );

  protected readonly activeOrders = computed(() =>
    this.activeTab() === 'PREPARED' ? this.preparedOrders() : this.paidOrders(),
  );

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.activeOrders().length / PAGE_SIZE)),
  );

  protected readonly paginatedOrders = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.activeOrders().slice(start, start + PAGE_SIZE);
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
      this.refreshLastSummaryPrintedAt(),
    ]);
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
