import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import {
  BootstrapSession,
  BusinessSettings,
  CashOpening,
  Category,
  CompletedOrder,
  DashboardSummary,
  DeliveryDriver,
  FloorTable,
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
  businessSettings!: Table<BusinessSettings, 'current'>;
  floorTables!: Table<FloorTable, string>;
  deliveryDrivers!: Table<DeliveryDriver, string>;
  cashOpenings!: Table<CashOpening, string>;

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

    this.version(3).stores({
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
      businessSettings: 'id',
    });

    this.version(4).stores({
      sessionContext: 'id',
      bootstrapSessions: 'branchId',
      products: 'id, categoryId, name',
      categories: 'id, name',
      printers: 'id, target',
      dashboard: 'branchId',
      eventQueue: 'eventUuid, branchId, deviceId, localStatus, deviceSequence',
      completedOrders: 'id, branchId, createdAt, channel, tableNumber, livreurId',
      syncCursors: 'id',
      reportPrintStates: 'id, branchId, reportType, lastPrintedAt',
      businessSettings: 'id',
      floorTables: 'id, number, zone, status',
      deliveryDrivers: 'id, number, status',
    });

    this.version(5).stores({
      sessionContext: 'id',
      bootstrapSessions: 'branchId',
      products: 'id, categoryId, name',
      categories: 'id, name',
      printers: 'id, target',
      dashboard: 'branchId',
      eventQueue: 'eventUuid, branchId, deviceId, localStatus, deviceSequence',
      completedOrders: 'id, branchId, createdAt, channel, tableNumber, livreurId',
      syncCursors: 'id',
      reportPrintStates: 'id, branchId, reportType, lastPrintedAt',
      businessSettings: 'id',
      floorTables: 'id, number, zone, status',
      deliveryDrivers: 'id, number, status',
      cashOpenings: 'id, branchId, dayKey',
    });
  }
}
