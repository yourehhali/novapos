import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { Category, DeliveryDriver, FloorTable, OrderChannel, Product } from '../../core/models/app.models';
import { PosService } from '../../core/services/pos.service';
import { ReceiptService } from '../../core/services/receipt.service';
import { SyncService } from '../../core/services/sync.service';
import { WorkspaceService } from '../../core/services/workspace.service';

@Component({
  selector: 'app-pos-page',
  templateUrl: './pos-page.component.html',
  styleUrls: ['./pos-page.component.scss'],
  standalone: false,
})
export class PosPageComponent implements OnInit, OnDestroy {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly receiptService = inject(ReceiptService);
  private readonly syncService = inject(SyncService);

  protected readonly pos = inject(PosService);
  protected readonly products = signal<Product[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly floorTables = signal<FloorTable[]>([]);
  protected readonly deliveryDrivers = signal<DeliveryDriver[]>([]);
  protected readonly selectedCategory = signal('all');
  protected readonly busy = signal(false);
  protected readonly searchTerm = signal('');
  protected readonly prepareError = signal<string | null>(null);
  private readonly subscriptions = new Subscription();

  protected readonly filteredProducts = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    return this.products().filter((product) => {
      const matchesCategory =
        this.selectedCategory() === 'all' || product.categoryId === this.selectedCategory();
      const matchesSearch =
        search.length === 0 ||
        product.name.toLowerCase().includes(search) ||
        product.sku.toLowerCase().includes(search);

      return matchesCategory && matchesSearch;
    });
  });

  async ngOnInit(): Promise<void> {
    await this.refreshAll();
    this.subscriptions.add(
      this.workspaceService.catalogChanged$.subscribe(() => {
        void this.refreshCatalog();
      }),
    );
    this.subscriptions.add(
      this.workspaceService.tablesChanged$.subscribe(() => {
        void this.refreshTables();
      }),
    );
    this.subscriptions.add(
      this.workspaceService.driversChanged$.subscribe(() => {
        void this.refreshDrivers();
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private async refreshAll(): Promise<void> {
    const [catalog, tables, drivers] = await Promise.all([
      this.workspaceService.loadCatalog(),
      this.pos.listFloorTables(),
      this.pos.listDeliveryDrivers(),
    ]);
    this.products.set(catalog.products.filter((p) => p.available !== false));
    this.categories.set(catalog.categories);
    this.floorTables.set(tables);
    this.deliveryDrivers.set(drivers.filter((d) => d.status === 'ACTIVE'));
  }

  private async refreshCatalog(): Promise<void> {
    const catalog = await this.workspaceService.loadCatalog();
    const cat = this.selectedCategory();
    this.products.set(catalog.products.filter((p) => p.available !== false));
    this.categories.set(catalog.categories);
    if (cat !== 'all' && !catalog.categories.some((c) => c.id === cat)) {
      this.selectedCategory.set('all');
    }
  }

  private async refreshTables(): Promise<void> {
    this.floorTables.set(await this.pos.listFloorTables());
  }

  private async refreshDrivers(): Promise<void> {
    const drivers = await this.pos.listDeliveryDrivers();
    this.deliveryDrivers.set(drivers.filter((d) => d.status === 'ACTIVE'));
    const livreur = this.pos.selectedLivreurId();
    if (livreur && !this.deliveryDrivers().some((d) => d.id === livreur)) {
      this.pos.selectedLivreurId.set('');
    }
  }

  protected setChannel(channel: OrderChannel): void {
    this.pos.setChannel(channel);
    this.prepareError.set(null);
  }

  protected setSelectedTableNumber(value: string): void {
    this.pos.selectedTableNumber.set(value);
    this.prepareError.set(null);
  }

  protected setSelectedLivreurId(value: string): void {
    this.pos.selectedLivreurId.set(value);
    this.prepareError.set(null);
  }

  protected setCustomerPhone(value: string): void {
    this.pos.customerPhone.set(value);
  }

  protected setDeliveryAddress(value: string): void {
    this.pos.deliveryAddress.set(value);
  }

  protected add(product: Product): void {
    this.pos.addProduct(product);
  }

  protected incrementFromCart(productId: string): void {
    const product = this.products().find((item) => item.id === productId);
    if (product) {
      this.add(product);
    }
  }

  protected async prepare(): Promise<void> {
    this.busy.set(true);
    this.prepareError.set(null);

    try {
      const channel = this.pos.channel();
      if (channel === 'SUR_PLACE' && !this.pos.selectedTableNumber()) {
        const hasTables = this.floorTables().length > 0;
        this.prepareError.set(
          hasTables
            ? 'Selectionnez une table pour "Sur place".'
            : 'Aucune table definie. Ajoutez-en dans Gestion > Tables ou utilisez le canal "A emporter".'
        );
        return;
      }
      if (channel === 'LIVRAISON' && !this.pos.selectedLivreurId()) {
        const hasDrivers = this.deliveryDrivers().length > 0;
        this.prepareError.set(
          hasDrivers
            ? 'Selectionnez un livreur pour une livraison.'
            : 'Aucun livreur defini. Ajoutez-en dans Gestion > Livreurs ou utilisez un autre canal.'
        );
        return;
      }
      const order = await this.pos.prepareOrder();
      if (order) {
        await this.receiptService.printKitchenTicket(order);
        this.syncService.scheduleSync(100);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async printLastOrder(): Promise<void> {
    const order = this.pos.lastOrder();
    if (!order) {
      return;
    }

    if (order.status === 'PAID') {
      await this.receiptService.printPaymentTicket(order);
      return;
    }

    await this.receiptService.printKitchenTicket(order);
  }

  protected categoryName(categoryId: string): string {
    return this.categories().find((category) => category.id === categoryId)?.name ?? 'Unassigned';
  }

  protected productCountForCategory(categoryId: string): number {
    return this.products().filter((product) => product.categoryId === categoryId).length;
  }

  protected quantityFor(productId: string): number {
    return this.pos.cart().find((line) => line.productId === productId)?.quantity ?? 0;
  }

  protected statusLabel(status: string): string {
    return status === 'PAID' ? 'Paye' : 'Prepare';
  }
}
