import { Component, OnInit, inject, signal } from '@angular/core';
import {
  DesktopPrinterInfo,
  DesktopRuntimeInfo,
  PrinterConfig,
  SyncStatus,
} from '../../core/models/app.models';
import { LanguageService } from '../../core/i18n/language.service';
import { DesktopBridgeService } from '../../core/services/desktop-bridge.service';
import { SyncService } from '../../core/services/sync.service';
import { WorkspaceService } from '../../core/services/workspace.service';

@Component({
  selector: 'app-settings-page',
  template: `
    <section class="settings-grid">
      <article class="panel">
        <p class="eyebrow">{{ lang.t('settings.poste') }}</p>
        <h1>{{ lang.t('settings.runtimeDesktop') }}</h1>

        <div class="setting-card" *ngIf="runtimeInfo() as runtime; else browserRuntime">
          <div class="setting-head">
            <strong>{{ runtime.platform }}</strong>
            <span class="badge">{{ runtime.packaged ? lang.t('settings.buildPackaged') : lang.t('settings.buildDev') }}</span>
          </div>
          <p>{{ lang.t('settings.runtimeVersion', { version: runtime.version }) }}</p>
        </div>

        <ng-template #browserRuntime>
          <div class="setting-card">
            <div class="setting-head">
              <strong>{{ lang.t('settings.webBrowser') }}</strong>
              <span class="badge">{{ lang.t('settings.fallback') }}</span>
            </div>
            <p>{{ lang.t('settings.browserPrintHelp') }}</p>
          </div>
        </ng-template>

        <div class="setting-card" *ngIf="desktopPrinters().length > 0">
          <strong>{{ lang.t('settings.systemPrintersDetected') }}</strong>
          <p *ngFor="let printer of desktopPrinters()">
            {{ printer.displayName || printer.name }}<br />
            <span class="muted-line">{{ printer.isDefault ? lang.t('settings.defaultPrinter') : lang.t('settings.available') }}</span>
          </p>
        </div>
      </article>

      <article class="panel">
        <p class="eyebrow">{{ lang.t('settings.printing') }}</p>
        <h1>{{ lang.t('settings.printerRouting') }}</h1>

        <div class="setting-card" *ngFor="let printer of printers()">
          <div class="setting-head">
            <strong>{{ printer.name }}</strong>
            <span class="badge">{{ printer.target }}</span>
          </div>
          <p>{{ printer.protocol }} · {{ printer.queueName }}</p>
          <p class="muted-line">
            {{ lang.t('settings.widthLabel', { width: printer.paperWidthMm || 80 }) }} ·
            {{ printer.printMode || 'THERMAL' }} ·
            {{ printer.silent === false ? lang.t('settings.dialogVisible') : lang.t('settings.silent') }}
          </p>
          <p class="muted-line">
            {{ lang.t('settings.localRouting') }}
            {{ printer.systemPrinterName || printer.name || printer.queueName }}
          </p>
          <p class="muted-line">{{ desktopMatch(printer) }}</p>
        </div>
      </article>

      <article class="panel">
        <p class="eyebrow">{{ lang.t('settings.sync') }}</p>
        <h1>{{ lang.t('settings.syncVisibility') }}</h1>

        <div class="setting-card" *ngIf="syncStatus() as status">
          <strong>{{ lang.t('settings.acceptedEvents') }}</strong>
          <p>{{ status.acceptedEvents }}</p>
          <strong>{{ lang.t('settings.duplicates') }}</strong>
          <p>{{ status.duplicateEvents }}</p>
          <strong>{{ lang.t('settings.pendingConflicts') }}</strong>
          <p>{{ status.pendingConflicts }}</p>
        </div>

        <button type="button" (click)="runManualSync()">{{ lang.t('settings.runManualSync') }}</button>
      </article>

      <app-pocket-panel></app-pocket-panel>
    </section>
  `,
  styles: [
    `
      .settings-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
      }

      .panel {
        padding: 0;
        border-radius: 0;
        border: 1px solid var(--surface-border);
        background: var(--surface);
      }

      .eyebrow {
        margin: 0;
        padding: 18px 22px 0;
        color: var(--muted);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      h1 {
        margin: 6px 0 0;
        padding: 0 22px 16px;
        font-size: 26px;
      }

      .setting-card {
        margin-top: 0;
        padding: 16px 22px;
        border-radius: 0;
        border-top: 1px solid var(--surface-border);
        background: transparent;
      }

      .setting-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }

      .setting-card p {
        margin-top: 8px;
        color: var(--muted);
      }

      .muted-line {
        color: var(--muted);
        font-size: 12px;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 0;
        border: 1px solid var(--surface-border);
        background: var(--surface-raised);
        color: var(--muted);
        font-size: 11px;
        font-weight: 600;
      }

      button {
        margin: 0;
        width: 100%;
        border: 1px solid var(--surface-border);
        border-top: 0;
        border-radius: 0;
        padding: 14px 16px;
        background: var(--accent);
        color: #041118;
        font-weight: 700;
        cursor: pointer;
      }

      @media (max-width: 1000px) {
        .settings-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  standalone: false,
})
export class SettingsPageComponent implements OnInit {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly desktopBridge = inject(DesktopBridgeService);
  private readonly syncService = inject(SyncService);
  protected readonly lang = inject(LanguageService);

  protected readonly printers = signal<PrinterConfig[]>([]);
  protected readonly runtimeInfo = signal<DesktopRuntimeInfo | null>(null);
  protected readonly desktopPrinters = signal<DesktopPrinterInfo[]>([]);
  protected readonly syncStatus = signal<SyncStatus | null>(null);

  async ngOnInit(): Promise<void> {
    const [printers, syncStatus, runtimeInfo, desktopPrinters] = await Promise.all([
      this.workspaceService.loadPrinters(),
      this.workspaceService.loadSyncStatus(),
      this.desktopBridge.getRuntimeInfo(),
      this.desktopBridge.listPrinters(),
    ]);

    this.printers.set(printers);
    this.syncStatus.set(syncStatus);
    this.runtimeInfo.set(runtimeInfo);
    this.desktopPrinters.set(desktopPrinters);
  }

  protected async runManualSync(): Promise<void> {
    this.syncService.scheduleSync(0);
    this.syncStatus.set(await this.workspaceService.loadSyncStatus());
  }

  protected desktopMatch(printer: PrinterConfig): string {
    if (!this.runtimeInfo()) {
      return this.lang.t('settings.desktopMatchUnavailable');
    }

    const candidates = [printer.systemPrinterName, printer.name, printer.queueName]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase());
    const match = this.desktopPrinters().find((desktopPrinter) => {
      const desktopNames = [desktopPrinter.name, desktopPrinter.displayName]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase());

      return desktopNames.some((name) => candidates.includes(name));
    });

    return match
      ? this.lang.t('settings.desktopMatchFound', { name: match.displayName || match.name })
      : this.lang.t('settings.desktopMatchNone');
  }
}
