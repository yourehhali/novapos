import { Injectable, inject } from '@angular/core';
import { NovaPosDbService } from '../../offline/novapos-db.service';
import {
  CompletedOrder,
  ReportPrintState,
  SalesSummaryRange,
  SalesSummaryReport,
} from '../models/app.models';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class SalesSummaryService {
  private readonly db = inject(NovaPosDbService);
  private readonly session = inject(SessionService);

  async buildReport(range: SalesSummaryRange): Promise<SalesSummaryReport | null> {
    const branch = this.session.branch();
    if (!branch) {
      return null;
    }

    const now = new Date();
    const state = await this.db.reportPrintStates.get(this.reportStateId(branch.branchId));
    const fromAt = this.resolveFromAt(range, state?.lastPrintedAt, now);
    const toAt = now.toISOString();

    const orders = await this.db.completedOrders.where('branchId').equals(branch.branchId).toArray();
    const paidOrders = orders
      .map((order) => this.normalizeOrder(order))
      .filter((order) => order.status === 'PAID')
      .filter((order) => {
        const paidAt = order.paidAt ?? order.lastUpdatedAt ?? order.createdAt;
        return paidAt >= fromAt && paidAt <= toAt;
      })
      .sort((left, right) => {
        const leftPaidAt = left.paidAt ?? left.lastUpdatedAt ?? left.createdAt;
        const rightPaidAt = right.paidAt ?? right.lastUpdatedAt ?? right.createdAt;
        return leftPaidAt.localeCompare(rightPaidAt);
      });

    const currency = paidOrders[0]?.currency ?? 'MAD';

    return {
      range,
      branchId: branch.branchId,
      branchName: branch.branchName,
      generatedAt: toAt,
      fromAt,
      toAt,
      orderCount: paidOrders.length,
      grandTotal: paidOrders.reduce((sum, order) => sum + order.total, 0),
      currency,
      entries: paidOrders.map((order) => ({
        orderId: order.id,
        orderNumber: order.orderNumber,
        paidAt: order.paidAt ?? order.lastUpdatedAt ?? order.createdAt,
        total: order.total,
        currency: order.currency,
      })),
    };
  }

  async getLastPrintedAt(): Promise<string | null> {
    const branch = this.session.branch();
    if (!branch) {
      return null;
    }

    const state = await this.db.reportPrintStates.get(this.reportStateId(branch.branchId));
    return state?.lastPrintedAt ?? null;
  }

  async markPrinted(report: SalesSummaryReport): Promise<void> {
    const state: ReportPrintState = {
      id: this.reportStateId(report.branchId),
      branchId: report.branchId,
      reportType: 'SALES_SUMMARY',
      lastPrintedAt: report.generatedAt,
    };

    await this.db.reportPrintStates.put(state);
  }

  private reportStateId(branchId: string): string {
    return `${branchId}:sales-summary`;
  }

  private resolveFromAt(range: SalesSummaryRange, lastPrintedAt: string | undefined, now: Date): string {
    if (range === 'LAST_REPORT' && lastPrintedAt) {
      return lastPrintedAt;
    }

    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    return dayStart.toISOString();
  }

  private normalizeOrder(order: CompletedOrder): CompletedOrder {
    const paymentMethod = order.paymentMethod === 'CARD' || order.paymentMethod === 'CASH'
      ? order.paymentMethod
      : 'UNPAID';
    const status = order.status ?? (paymentMethod === 'UNPAID' ? 'PREPARED' : 'PAID');

    return {
      ...order,
      paymentMethod,
      status,
      lastUpdatedAt: order.lastUpdatedAt ?? order.paidAt ?? order.createdAt,
      version: order.version ?? (status === 'PAID' ? 3 : 2),
    };
  }
}
