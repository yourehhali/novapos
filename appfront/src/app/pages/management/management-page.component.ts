import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BusinessSettings,
  Category,
  DeliveryDriver,
  DemoSeedingMode,
  FloorTable,
  LogoType,
  Product,
  ResourceStatus,
  TicketLayoutConfig,
} from '../../core/models/app.models';
import { NovaPosDbService } from '../../offline/novapos-db.service';
import { BusinessSettingsService } from '../../core/services/business-settings.service';
import { ReceiptService } from '../../core/services/receipt.service';
import { PosService } from '../../core/services/pos.service';
import { WorkspaceService } from '../../core/services/workspace.service';

const PIN_STORAGE_KEY = 'novapos.management.pin.authed';
const MANAGEMENT_PIN = '281998';

type MgmtTab = 'categories' | 'products' | 'settings' | 'tables' | 'drivers';
type SettingsTicketKind = 'payment' | 'kitchen';

@Component({
  selector: 'app-management-page',
  templateUrl: './management-page.component.html',
  styleUrls: ['./management-page.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class ManagementPageComponent implements OnInit {
  private readonly db = inject(NovaPosDbService);
  private readonly businessSettingsService = inject(BusinessSettingsService);
  private readonly receiptService = inject(ReceiptService);
  private readonly posService = inject(PosService);
  private readonly workspaceService = inject(WorkspaceService);

  protected readonly pinInput = signal('');
  protected readonly pinError = signal<string | null>(null);
  protected readonly pinAuthed = signal(false);

  protected readonly activeTab = signal<MgmtTab>('products');
  protected readonly products = signal<Product[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly productSearch = signal('');
  protected readonly floorTables = signal<FloorTable[]>([]);
  protected readonly deliveryDrivers = signal<DeliveryDriver[]>([]);

  protected readonly editingCategory = signal<Category | null>(null);
  protected readonly editingProduct = signal<Product | null>(null);
  protected readonly editingFloorTable = signal<FloorTable | null>(null);
  protected readonly editingDeliveryDriver = signal<DeliveryDriver | null>(null);
  protected readonly saveError = signal<string | null>(null);

  protected readonly editingSettings = signal<BusinessSettings | null>(null);
  protected readonly saveSettingsError = signal<string | null>(null);
  protected readonly saveSettingsSuccess = signal<string | null>(null);
  protected readonly settingsTicketTab = signal<SettingsTicketKind>('payment');
  protected readonly clearDataMode = signal<DemoSeedingMode | null>(null);
  protected readonly clearDataOpen = signal(false);
  protected readonly clearDataPin = signal('');
  protected readonly clearDataPinError = signal<string | null>(null);
  protected readonly clearDataBusy = signal(false);
  protected readonly clearDataSuccess = signal<string | null>(null);

  protected filteredProducts = computed(() => {
    const q = this.productSearch().trim().toLowerCase();
    const list = this.products();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        this.categoryName(p.categoryId).toLowerCase().includes(q),
    );
  });

  protected categoryName(categoryId: string): string {
    return this.categories().find((c) => c.id === categoryId)?.name ?? '-';
  }

  async ngOnInit(): Promise<void> {
    const stored = this.readPinSession();
    if (stored === 'true') {
      this.pinAuthed.set(true);
      await this.refreshAll();
    }
  }

  async submitPin(): Promise<void> {
    const value = this.pinInput().trim();
    if (value !== MANAGEMENT_PIN) {
      this.pinError.set('Code PIN incorrect');
      return;
    }
    this.pinError.set(null);
    this.pinInput.set('');
    this.pinAuthed.set(true);
    this.writePinSession('true');
    await this.refreshAll();
  }

  lockScreen(): void {
    this.pinAuthed.set(false);
    this.pinInput.set('');
    this.pinError.set(null);
    this.writePinSession('');
    this.editingCategory.set(null);
    this.editingProduct.set(null);
    this.editingFloorTable.set(null);
    this.editingDeliveryDriver.set(null);
    this.editingSettings.set(null);
    this.saveSettingsError.set(null);
    this.saveSettingsSuccess.set(null);
  }

  switchTab(tab: MgmtTab): void {
    this.activeTab.set(tab);
    this.saveError.set(null);
    this.editingCategory.set(null);
    this.editingProduct.set(null);
    this.editingFloorTable.set(null);
    this.editingDeliveryDriver.set(null);
    this.saveSettingsError.set(null);
    this.saveSettingsSuccess.set(null);
    if (tab === 'settings') {
      void this.loadSettings();
    }
  }

  protected isNewCategory(category: Category): boolean {
    return !this.categories().some((c) => c.id === category.id);
  }

  protected isNewProduct(product: Product): boolean {
    return !this.products().some((p) => p.id === product.id);
  }

  // ---- Products (typed form setters) ----

  setProductField<K extends keyof Product>(field: K, value: Product[K]): void {
    const current = this.editingProduct();
    if (!current) return;
    this.editingProduct.set({ ...current, [field]: value });
  }

  setProductPrice(value: string | number): void {
    const n = typeof value === 'string' ? Number(value) : value;
    this.setProductField('price', isNaN(n) ? 0 : n);
  }

  setProductAvailable(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.setProductField('available', checked);
  }

  newProduct(): void {
    this.saveError.set(null);
    const firstCat = this.categories()[0];
    this.editingProduct.set({
      id: `prod-new-${crypto.randomUUID().slice(0, 6)}`,
      name: '',
      categoryId: firstCat?.id ?? '',
      price: 0,
      currency: 'DH',
      sku: '',
      available: true,
    });
  }

  editProduct(product: Product): void {
    this.saveError.set(null);
    this.editingProduct.set({ ...product });
  }

  cancelProduct(): void {
    this.saveError.set(null);
    this.editingProduct.set(null);
  }

  async saveProduct(): Promise<void> {
    this.saveError.set(null);
    const prod = this.editingProduct();
    if (!prod) return;
    if (!prod.name.trim()) {
      this.saveError.set('Le nom du produit est requis.');
      return;
    }
    if (!prod.categoryId) {
      this.saveError.set('Veuillez choisir une categorie.');
      return;
    }
    if (Number.isNaN(Number(prod.price)) || Number(prod.price) < 0) {
      this.saveError.set('Le prix doit etre un nombre positif.');
      return;
    }
    try {
      await this.db.products.put(prod);
      this.editingProduct.set(null);
      this.saveError.set(null);
      await this.refreshProducts();
    } catch (err: unknown) {
      this.saveError.set(`Erreur d enregistrement : ${(err as Error)?.message ?? String(err)}`);
    }
  }

  async deleteProduct(product: Product): Promise<void> {
    if (!confirm(`Supprimer l article "${product.name}" ?`)) return;
    await this.db.products.delete(product.id);
    await this.refreshProducts();
  }

  productCountForCategory(categoryId: string): number {
    return this.products().filter((p) => p.categoryId === categoryId).length;
  }

  // ---- Categories (typed form setters) ----

  setCategoryField<K extends keyof Category>(field: K, value: Category[K]): void {
    const current = this.editingCategory();
    if (!current) return;
    this.editingCategory.set({ ...current, [field]: value });
  }

  newCategory(): void {
    this.saveError.set(null);
    this.editingCategory.set({
      id: `cat-new-${crypto.randomUUID().slice(0, 6)}`,
      name: '',
      description: '',
    });
  }

  editCategory(category: Category): void {
    this.saveError.set(null);
    this.editingCategory.set({ ...category });
  }

  cancelCategory(): void {
    this.saveError.set(null);
    this.editingCategory.set(null);
  }

  async saveCategory(): Promise<void> {
    this.saveError.set(null);
    const cat = this.editingCategory();
    if (!cat) return;
    if (!cat.name.trim()) {
      this.saveError.set('Le nom de la categorie est requis.');
      return;
    }
    try {
      await this.db.categories.put(cat);
      this.editingCategory.set(null);
      this.saveError.set(null);
      await this.refreshCategories();
    } catch (err: unknown) {
      this.saveError.set(`Erreur d enregistrement : ${(err as Error)?.message ?? String(err)}`);
    }
  }

  async deleteCategory(category: Category): Promise<void> {
    const hasProducts = this.products().some((p) => p.categoryId === category.id);
    const label = hasProducts
      ? `Supprimer la categorie "${category.name}" et TOUS ses produits ?`
      : `Supprimer la categorie "${category.name}" ?`;
    if (!confirm(label)) return;
    await this.db.transaction('rw', this.db.categories, this.db.products, async () => {
      await this.db.products.where('categoryId').equals(category.id).delete();
      await this.db.categories.delete(category.id);
    });
    await this.refreshAll();
  }

  // ---- Floor Tables ----

  protected isNewFloorTable(t: FloorTable): boolean {
    return !this.floorTables().some((row) => row.id === t.id);
  }

  createFloorTable(): void {
    const count = this.floorTables().length;
    this.saveError.set(null);
    this.editingFloorTable.set({
      id: `tbl-new-${crypto.randomUUID().slice(0, 10)}`,
      number: String(count + 1),
      label: '',
      zone: '',
      capacity: 4,
      status: 'ACTIVE',
    });
  }

  editFloorTable(t: FloorTable): void {
    this.saveError.set(null);
    this.editingFloorTable.set({ ...t });
  }

  cancelFloorTable(): void {
    this.editingFloorTable.set(null);
    this.saveError.set(null);
  }

  setTableField<K extends keyof FloorTable>(field: K, value: FloorTable[K]): void {
    const current = this.editingFloorTable();
    if (!current) return;
    this.editingFloorTable.set({ ...current, [field]: value });
  }

  setTableStatus(value: string): void {
    this.setTableField('status', (value === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as ResourceStatus);
  }

  setTableCapacity(v: string | number): void {
    const n = Math.max(1, Math.floor(Number(v) || 1));
    this.setTableField('capacity', n);
  }

  async saveFloorTable(): Promise<void> {
    const t = this.editingFloorTable();
    this.saveError.set(null);
    if (!t) return;
    if (!t.number?.trim()) {
      this.saveError.set('Le numero de table est requis.');
      return;
    }
    try {
      if (t.label.trim() === '') t.label = `Table ${t.number.trim()}`;
      await this.posService.saveFloorTable(t);
      this.editingFloorTable.set(null);
      await this.refreshFloorTables();
    } catch (err: unknown) {
      this.saveError.set(`Echec d enregistrement : ${(err as Error)?.message ?? String(err)}`);
    }
  }

  async deleteFloorTable(t: FloorTable): Promise<void> {
    if (!confirm(`Supprimer la table "${t.label || t.number}" ?`)) return;
    try {
      await this.posService.deleteFloorTable(t.id);
      await this.refreshFloorTables();
    } catch (err: unknown) {
      this.saveError.set(`Echec suppression : ${(err as Error)?.message ?? String(err)}`);
    }
  }

  private async refreshFloorTables(): Promise<void> {
    this.floorTables.set(await this.posService.listFloorTables());
  }

  // ---- Delivery Drivers / Livreurs ----

  protected isNewDeliveryDriver(d: DeliveryDriver): boolean {
    return !this.deliveryDrivers().some((row) => row.id === d.id);
  }

  createDeliveryDriver(): void {
    const count = this.deliveryDrivers().length;
    this.saveError.set(null);
    this.editingDeliveryDriver.set({
      id: `liv-new-${crypto.randomUUID().slice(0, 10)}`,
      number: String(count + 1),
      name: '',
      phone: '',
      vehicle: '',
      status: 'ACTIVE',
    });
  }

  editDeliveryDriver(d: DeliveryDriver): void {
    this.saveError.set(null);
    this.editingDeliveryDriver.set({ ...d });
  }

  cancelDeliveryDriver(): void {
    this.editingDeliveryDriver.set(null);
    this.saveError.set(null);
  }

  setDriverField<K extends keyof DeliveryDriver>(field: K, value: DeliveryDriver[K]): void {
    const current = this.editingDeliveryDriver();
    if (!current) return;
    this.editingDeliveryDriver.set({ ...current, [field]: value });
  }

  setDriverStatus(value: string): void {
    this.setDriverField('status', (value === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as ResourceStatus);
  }

  async saveDeliveryDriver(): Promise<void> {
    const d = this.editingDeliveryDriver();
    this.saveError.set(null);
    if (!d) return;
    if (!d.name.trim()) {
      this.saveError.set('Le nom du livreur est requis.');
      return;
    }
    if (!d.number?.trim()) {
      this.saveError.set('Le numero du livreur est requis.');
      return;
    }
    try {
      await this.posService.saveDeliveryDriver(d);
      this.editingDeliveryDriver.set(null);
      await this.refreshDeliveryDrivers();
    } catch (err: unknown) {
      this.saveError.set(`Echec d enregistrement : ${(err as Error)?.message ?? String(err)}`);
    }
  }

  async deleteDeliveryDriver(d: DeliveryDriver): Promise<void> {
    if (!confirm(`Supprimer le livreur "${d.name || d.number}" ?`)) return;
    try {
      await this.posService.deleteDeliveryDriver(d.id);
      await this.refreshDeliveryDrivers();
    } catch (err: unknown) {
      this.saveError.set(`Echec suppression : ${(err as Error)?.message ?? String(err)}`);
    }
  }

  private async refreshDeliveryDrivers(): Promise<void> {
    this.deliveryDrivers.set(await this.posService.listDeliveryDrivers());
  }

  // ---- Business Settings ----

  private async loadSettings(): Promise<void> {
    try {
      const loaded = await this.businessSettingsService.load();
      this.editingSettings.set({ ...loaded });
      this.saveSettingsError.set(null);
    } catch (err: unknown) {
      this.saveSettingsError.set(`Erreur chargement parametres : ${(err as Error)?.message ?? String(err)}`);
    }
  }

  setSettingsField<K extends keyof BusinessSettings>(field: K, value: BusinessSettings[K]): void {
    const current = this.editingSettings();
    if (!current) return;
    this.editingSettings.set({ ...current, [field]: value });
  }

  setSettingsLogoType(value: string): void {
    const v = (value ?? 'TEXT') as LogoType;
    this.setSettingsField('logoType', v);
  }

  setSettingsReceiptWidth(value: string | number): void {
    const n = Number(value);
    this.setSettingsField('receiptPaperWidthMm', n === 58 ? 58 : 80);
  }

  setSettingsKitchenWidth(value: string | number): void {
    const n = Number(value);
    this.setSettingsField('kitchenPaperWidthMm', n === 58 ? 58 : 80);
  }

  setSettingsTicketTab(kind: SettingsTicketKind): void {
    this.settingsTicketTab.set(kind);
  }

  getTicketLayout(kind: SettingsTicketKind): TicketLayoutConfig | null {
    const s = this.editingSettings();
    if (!s) return null;
    return kind === 'payment' ? (s.paymentTicket ?? null) : (s.kitchenTicket ?? null);
  }

  setTicketLayoutField<K extends keyof TicketLayoutConfig>(
    kind: SettingsTicketKind,
    field: K,
    value: TicketLayoutConfig[K],
  ): void {
    const s = this.editingSettings();
    if (!s) return;
    const key = kind === 'payment' ? 'paymentTicket' : 'kitchenTicket';
    const existing = (s[key] ?? {}) as TicketLayoutConfig;
    const merged: TicketLayoutConfig = { ...existing, [field]: value } as TicketLayoutConfig;
    this.editingSettings.set({ ...s, [key]: merged });
  }

  setTicketLayoutLogoType(kind: SettingsTicketKind, value: string): void {
    const v = (value ?? 'TEXT') as LogoType;
    this.setTicketLayoutField(kind, 'logoType', v);
  }

  async handleTicketLayoutLogoImageFile(kind: SettingsTicketKind, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.saveSettingsError.set('Le logo doit etre une image (PNG, JPG, etc).');
      return;
    }
    if (file.size > 1_500_000) {
      this.saveSettingsError.set('L image du logo est trop volumineuse (max 1.5 Mo).');
      return;
    }
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error ?? new Error('Echec lecture image'));
        reader.readAsDataURL(file);
      });
      this.setTicketLayoutField(kind, 'logoImageDataUrl', dataUrl);
      this.setTicketLayoutField(kind, 'logoType', 'IMAGE' as LogoType);
      this.saveSettingsError.set(null);
    } catch (err: unknown) {
      this.saveSettingsError.set(`Echec lecture image : ${(err as Error)?.message ?? String(err)}`);
    } finally {
      input.value = '';
    }
  }

  clearTicketLayoutLogoImage(kind: SettingsTicketKind): void {
    this.setTicketLayoutField(kind, 'logoImageDataUrl', '');
  }

  openClearDataConfirm(mode: DemoSeedingMode): void {
    this.clearDataMode.set(mode);
    this.clearDataPin.set('');
    this.clearDataPinError.set(null);
    this.clearDataSuccess.set(null);
    this.clearDataOpen.set(true);
  }

  cancelClearData(): void {
    if (this.clearDataBusy()) return;
    this.clearDataOpen.set(false);
    this.clearDataMode.set(null);
    this.clearDataPin.set('');
    this.clearDataPinError.set(null);
  }

  async submitClearDataPin(): Promise<void> {
    if (this.clearDataBusy()) return;
    const mode = this.clearDataMode();
    if (!mode) return;
    const pin = this.clearDataPin().trim();
    if (pin !== MANAGEMENT_PIN) {
      this.clearDataPinError.set('PIN incorrect.');
      return;
    }
    this.clearDataPinError.set(null);
    this.clearDataBusy.set(true);
    try {
      await this.workspaceService.wipeAllLocalData(mode);
      this.receiptService.invalidateSettingsCache();
      this.workspaceService.invalidateAllCaches();
      this.posService.clearCart();
      await this.refreshAll();
      await this.loadSettings();
      this.clearDataSuccess.set(
        mode === 'BLANK'
          ? 'Toutes les donnees locales ont ete supprimees. Vous pouvez fermer et reouvrir l app.'
          : 'Les donnees de demonstration ont ete reinstallees.',
      );
      this.clearDataOpen.set(false);
      this.clearDataMode.set(null);
    } catch (err: unknown) {
      this.clearDataPinError.set(`Echec reinitialisation : ${(err as Error)?.message ?? String(err)}`);
    } finally {
      this.clearDataBusy.set(false);
    }
  }

  async handleLogoImageFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.saveSettingsError.set('Le logo doit etre une image (PNG, JPG, etc).');
      return;
    }
    if (file.size > 1_500_000) {
      this.saveSettingsError.set('L image du logo est trop volumineuse (max 1.5 Mo).');
      return;
    }
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error ?? new Error('Echec lecture image'));
        reader.readAsDataURL(file);
      });
      this.setSettingsField('logoImageDataUrl', dataUrl);
      this.setSettingsField('logoType', 'IMAGE' as LogoType);
      this.saveSettingsError.set(null);
    } catch (err: unknown) {
      this.saveSettingsError.set(`Echec lecture image : ${(err as Error)?.message ?? String(err)}`);
    } finally {
      input.value = '';
    }
  }

  clearLogoImage(): void {
    const current = this.editingSettings();
    if (!current) return;
    this.editingSettings.set({ ...current, logoImageDataUrl: '' });
  }

  async saveSettings(): Promise<void> {
    this.saveSettingsError.set(null);
    this.saveSettingsSuccess.set(null);
    const settings = this.editingSettings();
    if (!settings) return;
    if (!settings.businessName.trim()) {
      this.saveSettingsError.set('Le nom de l entreprise est requis.');
      return;
    }
    try {
      await this.businessSettingsService.save(settings);
      this.receiptService.invalidateSettingsCache();
      this.saveSettingsSuccess.set('Parametres enregistres. Les prochains tiquets utiliseront ces valeurs.');
    } catch (err: unknown) {
      this.saveSettingsError.set(`Erreur d enregistrement : ${(err as Error)?.message ?? String(err)}`);
    }
  }


  // ---- Helpers ----

  private async refreshAll(): Promise<void> {
    await Promise.all([
      this.refreshCategories(),
      this.refreshProducts(),
      this.refreshFloorTables(),
      this.refreshDeliveryDrivers(),
    ]);
  }

  private async refreshCategories(): Promise<void> {
    const rows = await this.db.categories.orderBy('name').toArray();
    this.categories.set(rows);
  }

  private async refreshProducts(): Promise<void> {
    const rows = await this.db.products.orderBy('name').toArray();
    this.products.set(rows);
  }

  private readPinSession(): string {
    if (typeof sessionStorage === 'undefined') return '';
    return sessionStorage.getItem(PIN_STORAGE_KEY) ?? '';
  }

  private writePinSession(value: string): void {
    if (typeof sessionStorage === 'undefined') return;
    if (value) {
      sessionStorage.setItem(PIN_STORAGE_KEY, value);
    } else {
      sessionStorage.removeItem(PIN_STORAGE_KEY);
    }
  }
}
