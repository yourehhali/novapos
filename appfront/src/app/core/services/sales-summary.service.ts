import { Injectable, inject } from '@angular/core';
import { RoxPosDbService } from '../../offline/RoxPos-db.service';
import {
  CompletedOrder,
  OrderChannel,
  ReportPrintState,
  SalesSummaryRange,
  SalesSummaryReport,
  SalesSummaryVatLine,
} from '../models/app.models';
import { SessionService } from './session.service';
import { extractOrderVat } from './pos.service';

const CHANNEL_ORDER: OrderChannel[] = ['SUR_PLACE', 'EMPORTER', 'LIVRAISON'];

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Groups the day's paid orders per sales channel and extracts the VAT of each
 * group. Prices are VAT-inclusive, so the VAT is taken out of the collected
 * total using the rate that applies to the channel.
 */
function buildVatBreakdown(orders: CompletedOrder[]): SalesSummaryVatLine[] {
  const buckets = new Map<OrderChannel, SalesSummaryVatLine>();

  for (const order of orders) {
    const { vatRate, vatAmount, netTotal } = extractOrderVat(order.channel, order.total);
    const line = buckets.get(order.channel) ?? {
      channel: order.channel,
      vatRate,
      orderCount: 0,
      grossTotal: 0,
      netTotal: 0,
      vatAmount: 0,
    };

    line.orderCount += 1;
    line.grossTotal += order.total;
    line.netTotal += netTotal;
    line.vatAmount += vatAmount;
    buckets.set(order.channel, line);
  }

  return CHANNEL_ORDER.filter((channel) => buckets.has(channel)).map((channel) => {
    const line = buckets.get(channel)!;
    return {
      ...line,
      grossTotal: round2(line.grossTotal),
      netTotal: round2(line.netTotal),
      vatAmount: round2(line.vatAmount),
    };
  });
}

@Injectable({ providedIn: 'root' })
export class SalesSummaryService {
  private readonly db = inject(RoxPosDbService);
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
    const vatBreakdown = buildVatBreakdown(paidOrders);

    return {
      range,
      branchId: branch.branchId,
      branchName: branch.branchName,
      generatedAt: toAt,
      fromAt,
      toAt,
      orderCount: paidOrders.length,
      grandTotal: paidOrders.reduce((sum, order) => sum + order.total, 0),
      totalNet: round2(vatBreakdown.reduce((sum, line) => sum + line.netTotal, 0)),
      totalVat: round2(vatBreakdown.reduce((sum, line) => sum + line.vatAmount, 0)),
      currency,
      entries: paidOrders.map((order) => ({
        orderId: order.id,
        orderNumber: order.orderNumber,
        paidAt: order.paidAt ?? order.lastUpdatedAt ?? order.createdAt,
        total: order.total,
        currency: order.currency,
      })),
      vatBreakdown,
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
