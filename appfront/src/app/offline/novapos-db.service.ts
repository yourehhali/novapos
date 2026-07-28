import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import {
  BootstrapSession,
  Category,
  CompletedOrder,
  DashboardSummary,
  PrinterConfig,
  Product,
  QueueEntry,
  ReportPrintState,
} from '../core/models/app.models';

export interface SessionContextRecord {
  id: 'current';
  accessToken: string;
  refreshToken: string;
  user: string;
  branchId?: string;
  branchName?: string;
  deviceCode?: string;
  deviceType?: string;
}

@Injectable({ providedIn: 'root' })
export class NovaPosDbService extends Dexie {
  sessionContext!: Table<SessionContextRecord, string>;
  bootstrapSessions!: Table<BootstrapSession, string>;
  products!: Table<Product, string>;
  categories!: Table<Category, string>;
  printers!: Table<PrinterConfig, string>;
  dashboard!: Table<DashboardSummary, string>;
  eventQueue!: Table<QueueEntry, string>;
  completedOrders!: Table<CompletedOrder, string>;
  syncCursors!: Table<{ id: string; cursor: string }, string>;
  reportPrintStates!: Table<ReportPrintState, string>;

  constructor() {
    super('NovaPosDb');

    this.version(1).stores({
      sessionContext: 'id',
      bootstrapSessions: 'branchId',
      products: 'id, categoryId, name',
      categories: 'id, name',
      printers: 'id, target',
      dashboard: 'branchId',
      eventQueue: 'eventUuid, branchId, deviceId, localStatus, deviceSequence',
      completedOrders: 'id, branchId, createdAt',
      syncCursors: 'id',
    });

    this.version(2).stores({
      sessionContext: 'id',
      bootstrapSessions: 'branchId',
      products: 'id, categoryId, name',
      categories: 'id, name',
      printers: 'id, target',
      dashboard: 'branchId',
      eventQueue: 'eventUuid, branchId, deviceId, localStatus, deviceSequence',
      completedOrders: 'id, branchId, createdAt',
      syncCursors: 'id',
      reportPrintStates: 'id, branchId, reportType, lastPrintedAt',
    });
  }
}
