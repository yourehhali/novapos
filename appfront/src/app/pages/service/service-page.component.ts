import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CompletedOrder, DeliveryDriver, FloorTable } from '../../core/models/app.models';
import { PosService } from '../../core/services/pos.service';
import { WorkspaceService } from '../../core/services/workspace.service';

type ServiceTab = 'tables' | 'deliveries';

@Component({
  selector: 'app-service-page',
  templateUrl: './service-page.component.html',
  styleUrls: ['./service-page.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class ServicePageComponent implements OnInit, OnDestroy {
  private readonly posService = inject(PosService);
  private readonly workspaceService = inject(WorkspaceService);

  protected readonly activeTab = signal<ServiceTab>('tables');
  protected readonly floorTables = signal<FloorTable[]>([]);
  protected readonly deliveryDrivers = signal<DeliveryDriver[]>([]);
  protected readonly allOrders = signal<CompletedOrder[]>([]);
  private readonly subscriptions = new Subscription();

  protected readonly tablesWithOrders = computed(() => {
    const orders = this.allOrders().filter((o) => o.channel === 'SUR_PLACE');
    return this.floorTables().map((table) => ({
      table,
      openPreparedOrders: orders.filter(
        (o) => o.tableNumber === table.number && o.status === 'PREPARED',
      ),
      paidOrders: orders.filter(
        (o) => o.tableNumber === table.number && o.status === 'PAID',
      ),
    }));
  });

  protected readonly deliveriesByDriver = computed(() => {
    const allPreparedLiv = this.allOrders().filter(
      (o) => o.channel === 'LIVRAISON' && o.status === 'PREPARED',
    );
    const rows: { driver: DeliveryDriver | null; orders: CompletedOrder[] }[] = [];
    const mappedLivreurIds = new Set<string>();
    for (const driver of this.deliveryDrivers()) {
      const orders = allPreparedLiv.filter((o) => o.livreurId === driver.id);
      mappedLivreurIds.add(driver.id);
      rows.push({ driver, orders });
    }
    const unassigned = allPreparedLiv.filter(
      (o) => !o.livreurId || !mappedLivreurIds.has(o.livreurId),
    );
    if (unassigned.length > 0) {
      rows.unshift({ driver: null, orders: unassigned });
    }
    return rows;
  });

  protected readonly takeawayOrders = computed(() =>
    this.allOrders().filter((o) => o.channel === 'EMPORTER'),
  );

  async ngOnInit(): Promise<void> {
    await this.refresh();
    this.subscriptions.add(
      this.workspaceService.tablesChanged$.subscribe(() => void this.refreshTables()),
    );
    this.subscriptions.add(
      this.workspaceService.driversChanged$.subscribe(() => void this.refreshDrivers()),
    );
    this.subscriptions.add(
      this.workspaceService.catalogChanged$.subscribe(() => void this.refresh()),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  async refresh(): Promise<void> {
    const [tables, drivers, orders] = await Promise.all([
      this.posService.listFloorTables(),
      this.posService.listDeliveryDrivers(),
      this.posService.listCompletedOrders(),
    ]);
    this.floorTables.set(tables);
    this.deliveryDrivers.set(drivers);
    this.allOrders.set(orders);
  }

  private async refreshTables(): Promise<void> {
    this.floorTables.set(await this.posService.listFloorTables());
  }

  private async refreshDrivers(): Promise<void> {
    this.deliveryDrivers.set(await this.posService.listDeliveryDrivers());
  }

  setTab(tab: ServiceTab): void {
    this.activeTab.set(tab);
  }

  driverName(livreurId?: string): string {
    if (!livreurId) return 'Non assigne';
    const d = this.deliveryDrivers().find((row) => row.id === livreurId);
    return d ? `N°${d.number} - ${d.name}` : 'Non assigne';
  }

  async reopenOrder(orderId: string): Promise<void> {
    await this.posService.reopenPreparedOrder(orderId);
  }

  totalOf(order: CompletedOrder): string {
    return new Intl.NumberFormat('fr-MA', {
      style: 'currency',
      currency: order.currency || 'MAD',
      maximumFractionDigits: 2,
    }).format(order.total);
  }
}
