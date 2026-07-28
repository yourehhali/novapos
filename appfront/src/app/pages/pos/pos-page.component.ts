import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Category, Product } from '../../core/models/app.models';
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
export class PosPageComponent implements OnInit {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly receiptService = inject(ReceiptService);
  private readonly syncService = inject(SyncService);

  protected readonly pos = inject(PosService);
  protected readonly products = signal<Product[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly selectedCategory = signal('all');
  protected readonly busy = signal(false);
  protected readonly searchTerm = signal('');

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
    const catalog = await this.workspaceService.loadCatalog();
    this.products.set(catalog.products);
    this.categories.set(catalog.categories);
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

    try {
      const order = await this.pos.prepareOrder();
      if (order) {
        await this.receiptService.printKitchenTicket(order);
        await this.syncService.runSync();
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
