import { Component, OnInit, inject, signal } from '@angular/core';
import { CompletedOrder, PaymentMethod, SalesSummaryRange } from '../../core/models/app.models';
import { PosService } from '../../core/services/pos.service';
import { ReceiptService } from '../../core/services/receipt.service';
import { SalesSummaryService } from '../../core/services/sales-summary.service';
import { SessionService } from '../../core/services/session.service';
import { SyncService } from '../../core/services/sync.service';

@Component({
  selector: 'app-order-history-page',
  templateUrl: './order-history-page.component.html',
  styleUrls: ['./order-history-page.component.scss'],
  standalone: false,
})
export class OrderHistoryPageComponent implements OnInit {
  private readonly posService = inject(PosService);
  private readonly receiptService = inject(ReceiptService);
  private readonly salesSummaryService = inject(SalesSummaryService);
  private readonly session = inject(SessionService);
  private readonly syncService = inject(SyncService);

  protected readonly orders = signal<CompletedOrder[]>([]);
  protected readonly paymentMethods = signal<Record<string, 'CASH' | 'CARD'>>({});
  protected readonly printingSummary = signal(false);
  protected readonly lastSummaryPrintedAt = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.reloadOrders(),
      this.refreshLastSummaryPrintedAt(),
    ]);
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
    await this.reloadOrders();
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

  private async reloadOrders(): Promise<void> {
    const orders = await this.posService.listCompletedOrders(this.session.branch()?.branchId);
    this.orders.set(orders);

    const paymentMethods: Record<string, 'CASH' | 'CARD'> = {};
    for (const order of orders) {
      paymentMethods[order.id] = order.paymentMethod === 'CARD' ? 'CARD' : 'CASH';
    }
    this.paymentMethods.set(paymentMethods);
  }

  private async refreshLastSummaryPrintedAt(): Promise<void> {
    this.lastSummaryPrintedAt.set(await this.salesSummaryService.getLastPrintedAt());
  }
}
