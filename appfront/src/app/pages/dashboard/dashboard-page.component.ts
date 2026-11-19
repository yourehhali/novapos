import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject, filter, takeUntil } from 'rxjs';
import { CashOpening, DashboardSummary, SyncStatus } from '../../core/models/app.models';
import { PosService } from '../../core/services/pos.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { BusinessSettingsService } from '../../core/services/business-settings.service';
import { LanguageService } from '../../core/i18n/language.service';

const MANAGEMENT_PIN = '281998';

@Component({
  selector: 'app-dashboard-page',
  template: `
    <section class="dashboard">
      <header class="page-header">
        <div>
          <p class="eyebrow">{{ lang.t('dashboard.eyebrow') }}</p>
          <h1>{{ lang.t('dashboard.title') }}</h1>
        </div>
      </header>

      <div class="metrics metrics-four">
        <article class="metric-card">
          <span>{{ lang.t('dashboard.activeOrders') }}</span>
          <strong>{{ summary()?.activeOrders ?? 0 }}</strong>
        </article>
        <article class="metric-card">
          <span>{{ lang.t('dashboard.revenueToday') }}</span>
          <strong>{{ summary()?.revenueToday ?? 0 | number: '1.2-2' }} MAD</strong>
          <small class="metric-sub">
            {{ lang.t('dashboard.cashLabel') }}: {{ summary()?.revenueCashToday ?? 0 | number: '1.2-2' }}
            · {{ lang.t('dashboard.cardLabel') }}: {{ summary()?.revenueCardToday ?? 0 | number: '1.2-2' }}
          </small>
        </article>
        <article class="metric-card cash-card">
          <header class="cash-header">
            <div>
              <span>{{ lang.t('dashboard.cashDrawer') }}</span>
              <strong>
                <ng-container *ngIf="cashOpening(); else noCashOpening">
                  {{ cashOpening()!.amount | number: '1.2-2' }} {{ cashOpening()!.currency }}
                </ng-container>
                <ng-template #noCashOpening>
                  {{ lang.t('dashboard.notSet') }}
                </ng-template>
              </strong>
              <small class="metric-sub" *ngIf="cashOpening() as co">
                {{ lang.t('dashboard.cashSetAt', { date: (co.setAt | date: 'dd/MM HH:mm') || '' }) }}
              </small>
            </div>
            <button
              type="button"
              class="cash-button"
              (click)="openCashModal()"
              [attr.title]="lang.t('dashboard.editCashDrawer')"
            >
              {{ cashOpening() ? lang.t('common.edit') : lang.t('dashboard.define') }}
            </button>
          </header>
          <div class="cash-breakdown">
            <div class="cash-line">
              <span>{{ lang.t('dashboard.cashCollections') }}</span>
              <strong>{{ summary()?.revenueCashToday ?? 0 | number: '1.2-2' }} MAD</strong>
            </div>
            <div class="cash-line total-expected">
              <span>{{ lang.t('dashboard.expectedCash') }}</span>
              <strong>{{ expectedCashDrawer() | number: '1.2-2' }} MAD</strong>
            </div>
          </div>
        </article>
        <article class="metric-card accent">
          <span>{{ lang.t('dashboard.queuedEvents') }}</span>
          <strong>{{ pendingQueueDepth() }}</strong>
        </article>
      </div>

      <div class="panel-grid">
        <article class="panel">
          <h2>{{ lang.t('dashboard.operationalNotes') }}</h2>
          <ul>
            <li *ngFor="let note of summary()?.operationalNotes || []">{{ note }}</li>
          </ul>
        </article>

        <article class="panel">
          <h2>{{ lang.t('dashboard.syncStatus') }}</h2>
          <p>{{ lang.t('dashboard.acceptedEvents') }}: {{ syncStatus()?.acceptedEvents ?? 0 }}</p>
          <p>{{ lang.t('dashboard.duplicateEvents') }}: {{ syncStatus()?.duplicateEvents ?? 0 }}</p>
          <p>{{ lang.t('dashboard.pendingConflicts') }}: {{ syncStatus()?.pendingConflicts ?? 0 }}</p>
          <p>{{ lang.t('dashboard.lastSync') }}: {{ summary()?.lastSuccessfulSyncAt || lang.t('dashboard.pending') }}</p>
        </article>
      </div>
    </section>

    <!-- Fond de caisse modal -->
    <div class="modal-overlay" *ngIf="cashModalOpen()" (click.self)="closeCashModal()">
      <article class="modal-card" (click)="$event.stopPropagation()">
        <header class="modal-header">
          <div>
            <p class="eyebrow">{{ cashOpening() ? lang.t('dashboard.editCashDrawer') : lang.t('dashboard.defineCashDrawer') }}</p>
            <h2>{{ todayLabel() }}</h2>
          </div>
          <button type="button" class="modal-close" (click)="closeCashModal()" [attr.aria-label]="lang.t('common.close')">&times;</button>
        </header>

        <!-- PIN gate -->
        <div class="pin-gate" *ngIf="!cashPinAuthed()">
          <p class="form-eyebrow">{{ lang.t('dashboard.securedAccess') }}</p>
          <label class="pin-field">
            <span>{{ lang.t('dashboard.managementPin') }}</span>
            <input
              type="password"
              inputmode="numeric"
              autocomplete="off"
              maxlength="6"
              placeholder="• • • • • •"
              #cashPinInput
              [ngModel]="cashPinInputValue()"
              (keyup.enter)="submitCashPin()"
              (ngModelChange)="cashPinInputValue.set($event)"
            />
          </label>
          <div class="form-error" *ngIf="cashPinError()">
            {{ cashPinError() }}
          </div>
          <div class="form-actions">
            <button type="button" class="secondary-button" (click)="closeCashModal()">{{ lang.t('common.cancel') }}</button>
            <button type="button" class="primary-button" (click)="submitCashPin()">
              {{ lang.t('dashboard.validatePin') }}
            </button>
          </div>
        </div>

        <!-- Amount form -->
        <div *ngIf="cashPinAuthed()">
          <div class="form-error" *ngIf="cashSaveError()">{{ cashSaveError() }}</div>
          <div class="form-grid">
            <label>
              <span>{{ lang.t('dashboard.cashDrawerAmount', { currency: displayCurrency() }) }}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                [ngModel]="cashAmountInput()"
                (ngModelChange)="cashAmountInput.set($event)"
                [attr.placeholder]="lang.t('dashboard.amountPlaceholder')"
              />
            </label>
            <label>
              <span>{{ lang.t('dashboard.noteOptional') }}</span>
              <input
                type="text"
                [ngModel]="cashNoteInput()"
                (ngModelChange)="cashNoteInput.set($event)"
                [attr.placeholder]="lang.t('dashboard.notePlaceholder')"
              />
            </label>
          </div>
          <div class="cash-preview">
            <small>{{ lang.t('dashboard.expectedCashAfterSave') }}</small>
            <strong>{{ previewExpected() | number: '1.2-2' }} {{ displayCurrency() }}</strong>
          </div>
          <div class="form-actions">
            <button type="button" class="secondary-button" (click)="closeCashModal()">{{ lang.t('common.cancel') }}</button>
            <button type="button" class="primary-button" [disabled]="cashSaving()" (click)="saveCashOpening()">
              {{ cashSaving() ? lang.t('dashboard.saving') : lang.t('common.save') }}
            </button>
          </div>
        </div>
      </article>
    </div>
  `,
  styles: [
    `
      .dashboard {
        display: grid;
        gap: 18px;
      }

      .page-header h1 {
        margin-top: 6px;
        font-size: 30px;
      }

      .eyebrow {
        color: var(--muted);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .metrics {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
      }

      .metrics-four {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .metric-card,
      .panel {
        padding: 20px;
        border-radius: var(--radius-lg);
        border: 1px solid var(--surface-border);
        background: var(--surface);
        box-shadow: var(--shadow-soft);
      }

      .metric-card span,
      .panel p,
      li {
        color: var(--muted);
      }

      .metric-card > span {
        display: block;
        font-size: 12px;
      }

      .metric-card strong {
        display: block;
        margin-top: 8px;
        font-size: 28px;
        color: var(--text);
      }

      .metric-sub {
        display: block;
        margin-top: 10px;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.5;
      }

      .metric-card.accent {
        border-color: var(--surface-border);
        background: var(--surface-raised);
      }

      /* -------- Fond de caisse card -------- */
      .cash-card {
        grid-column: span 1;
        border-color: color-mix(in srgb, var(--success) 30%, var(--surface-border));
        background: linear-gradient(
          180deg,
          color-mix(in srgb, var(--success) 6%, var(--surface)) 0%,
          var(--surface) 100%
        );
        display: grid;
        gap: 12px;
      }

      .cash-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }

      .cash-header > div {
        min-width: 0;
      }

      .cash-header span {
        display: block;
        font-size: 12px;
        color: var(--muted);
      }

      .cash-header strong {
        display: block;
        margin-top: 8px;
        font-size: 24px;
        color: var(--text);
      }

      .cash-button {
        flex: 0 0 auto;
        padding: 7px 12px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--surface-border);
        background: var(--surface-raised);
        color: var(--text);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 140ms ease, border-color 140ms ease;
      }

      .cash-button:hover {
        background: var(--surface-soft);
        border-color: color-mix(in srgb, var(--text) 25%, transparent);
      }

      .cash-breakdown {
        display: grid;
        gap: 6px;
        padding-top: 12px;
        border-top: 1px dashed var(--surface-border);
      }

      .cash-line {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 10px;
        font-size: 12px;
      }

      .cash-line span {
        color: var(--muted);
      }

      .cash-line strong {
        font-size: 13px;
        color: var(--text);
      }

      .cash-line.total-expected {
        padding-top: 6px;
        border-top: 1px solid var(--surface-border);
      }

      .cash-line.total-expected span {
        color: var(--muted-strong);
        font-weight: 600;
      }

      .cash-line.total-expected strong {
        color: var(--success);
        font-size: 16px;
      }

      .panel-grid {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 18px;
      }

      ul {
        padding-left: 18px;
        margin: 12px 0 0;
      }

      .panel h2 {
        margin-bottom: 12px;
        font-size: 20px;
      }

      .panel p + p {
        margin-top: 8px;
      }

      /* -------- Modal fond de caisse -------- */
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(4, 6, 9, 0.72);
        backdrop-filter: blur(2px);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }

      .modal-card {
        width: min(520px, 100%);
        background: var(--surface);
        border: 1px solid var(--surface-border);
        border-radius: var(--radius-lg);
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
        padding: 20px;
        display: grid;
        gap: 14px;
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }

      .modal-header h2 {
        margin-top: 4px;
        font-size: 22px;
      }

      .modal-close {
        background: transparent;
        border: 0;
        color: var(--muted);
        font-size: 28px;
        line-height: 1;
        cursor: pointer;
        padding: 2px 8px;
        border-radius: var(--radius-sm);
        transition: background-color 120ms ease, color 120ms ease;
      }

      .modal-close:hover {
        background: var(--surface-soft);
        color: var(--text);
      }

      .form-eyebrow {
        margin: 0;
        color: var(--muted);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-weight: 600;
      }

      .pin-gate {
        display: grid;
        gap: 12px;
      }

      .pin-field {
        display: grid;
        gap: 6px;
      }

      .pin-field > span {
        font-size: 12px;
        font-weight: 600;
        color: var(--muted-strong);
      }

      .pin-field input {
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        width: 100%;
        background: var(--bg);
        border: 1px solid var(--surface-border);
        color: var(--text);
        font-size: 16px;
        letter-spacing: 0.3em;
        font-weight: 600;
        outline: none;
        transition: border-color 140ms ease;
      }

      .pin-field input:focus {
        border-color: var(--text);
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .form-grid label {
        display: grid;
        gap: 6px;
      }

      .form-grid label > span {
        font-size: 11px;
        color: var(--muted);
        font-weight: 600;
        letter-spacing: 0.02em;
      }

      .form-grid input {
        padding: 9px 11px;
        border-radius: var(--radius-sm);
        background: var(--bg);
        border: 1px solid var(--surface-border);
        color: var(--text);
        font-size: 14px;
        outline: none;
        transition: border-color 140ms ease;
      }

      .form-grid input:focus {
        border-color: var(--text);
      }

      .form-error {
        padding: 8px 10px;
        border-radius: var(--radius-sm);
        background: color-mix(in srgb, var(--danger) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--danger) 26%, transparent);
        color: var(--danger);
        font-size: 12px;
        font-weight: 500;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .primary-button,
      .secondary-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 9px 14px;
        border-radius: var(--radius-sm);
        border: 1px solid transparent;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        transition: background-color 140ms ease, color 140ms ease, opacity 140ms ease;
      }

      .primary-button {
        background: var(--text);
        color: var(--bg);
        border-color: var(--text);
      }

      .primary-button:hover:not(:disabled) {
        opacity: 0.92;
      }

      .primary-button:disabled {
        opacity: 0.55;
        cursor: default;
      }

      .secondary-button {
        background: var(--surface-raised);
        color: var(--text);
        border-color: var(--surface-border);
      }

      .secondary-button:hover {
        background: var(--surface-soft);
      }

      .cash-preview {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        background: var(--surface-raised);
        border: 1px solid var(--surface-border);
      }

      .cash-preview small {
        color: var(--muted);
        font-size: 12px;
      }

      .cash-preview strong {
        font-size: 18px;
        color: var(--success);
      }

      @media (max-width: 1200px) {
        .metrics-four {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 720px) {
        .metrics,
        .metrics-four,
        .panel-grid {
          grid-template-columns: 1fr;
        }
        .form-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  standalone: false,
})
export class DashboardPageComponent implements OnInit, OnDestroy {
  protected readonly lang = inject(LanguageService);
  private readonly workspaceService = inject(WorkspaceService);
  private readonly posService = inject(PosService);
  private readonly businessSettingsService = inject(BusinessSettingsService);
  private readonly router = inject(Router);

  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly syncStatus = signal<SyncStatus | null>(null);
  protected readonly pendingQueueDepth = signal(0);

  protected readonly cashOpening = signal<CashOpening | null>(null);
  protected readonly displayCurrency = signal<string>('DH');

  protected readonly cashModalOpen = signal(false);
  protected readonly cashPinAuthed = signal(false);
  protected readonly cashPinInputValue = signal('');
  protected readonly cashPinError = signal<string | null>(null);
  protected readonly cashAmountInput = signal<number | ''>('');
  protected readonly cashNoteInput = signal('');
  protected readonly cashSaveError = signal<string | null>(null);
  protected readonly cashSaving = signal(false);

  protected readonly expectedCashDrawer = computed(() => {
    const opening = this.cashOpening();
    const cashToday = this.summary()?.revenueCashToday ?? 0;
    return (opening?.amount ?? 0) + cashToday;
  });

  protected readonly previewExpected = computed(() => {
    const input = this.cashAmountInput();
    const amount = typeof input === 'number' ? Number.isFinite(input) ? input : 0 : 0;
    const cashToday = this.summary()?.revenueCashToday ?? 0;
    return amount + cashToday;
  });

  protected readonly todayLabel = computed(() =>
    new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
  );

  private readonly destroy$ = new Subject<void>();

  async ngOnInit(): Promise<void> {
    await this.loadData();

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$),
      )
      .subscribe(async (event) => {
        if ((event as NavigationEnd).urlAfterRedirects.startsWith('/dashboard')) {
          await this.loadData();
        }
      });

    this.workspaceService.catalogChanged$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => void this.loadData());
    this.workspaceService.businessSettingsChanged$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => void this.loadData());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected openCashModal(): void {
    const existing = this.cashOpening();
    this.cashPinAuthed.set(false);
    this.cashPinInputValue.set('');
    this.cashPinError.set(null);
    this.cashSaveError.set(null);
    this.cashSaving.set(false);
    this.cashNoteInput.set(existing?.note ?? '');
    this.cashAmountInput.set(existing ? existing.amount : '');
    this.cashModalOpen.set(true);
  }

  protected closeCashModal(): void {
    this.cashModalOpen.set(false);
    this.cashPinAuthed.set(false);
    this.cashPinInputValue.set('');
    this.cashPinError.set(null);
    this.cashSaveError.set(null);
    this.cashSaving.set(false);
  }

  protected submitCashPin(): void {
    if (this.cashPinInputValue() === MANAGEMENT_PIN) {
      this.cashPinAuthed.set(true);
      this.cashPinError.set(null);
      this.cashPinInputValue.set('');
    } else {
      this.cashPinError.set(this.lang.t('dashboard.pinIncorrect'));
    }
  }

  protected async saveCashOpening(): Promise<void> {
    const raw = this.cashAmountInput();
    const amount = typeof raw === 'number' ? raw : Number.parseFloat(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      this.cashSaveError.set(this.lang.t('dashboard.invalidAmount'));
      return;
    }
    try {
      this.cashSaving.set(true);
      this.cashSaveError.set(null);
      const saved = await this.posService.setTodayCashOpening(
        amount,
        this.displayCurrency(),
        this.cashNoteInput() || undefined,
        undefined,
      );
      this.cashOpening.set(saved);
      this.closeCashModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : this.lang.t('dashboard.saveFailed');
      this.cashSaveError.set(message);
    } finally {
      this.cashSaving.set(false);
    }
  }

  private async loadData(): Promise<void> {
    const [summary, syncStatus, pendingQueueDepth, cashOpening, settings] = await Promise.all([
      this.workspaceService.loadDashboard(),
      this.workspaceService.loadSyncStatus(),
      this.posService.getPendingQueueDepth(),
      this.posService.getTodayCashOpening(),
      this.businessSettingsService.load().catch(() => null),
    ]);

    this.summary.set(summary);
    this.syncStatus.set(syncStatus);
    this.pendingQueueDepth.set(pendingQueueDepth);
    this.cashOpening.set(cashOpening);
    this.displayCurrency.set(settings?.currency?.trim() || cashOpening?.currency || 'DH');
  }
}
