import { Component, OnInit, inject, signal } from '@angular/core';
import {
  DesktopPrinterInfo,
  DesktopRuntimeInfo,
  PrinterConfig,
  SyncStatus,
} from '../../core/models/app.models';
import { DesktopBridgeService } from '../../core/services/desktop-bridge.service';
import { SyncService } from '../../core/services/sync.service';
import { WorkspaceService } from '../../core/services/workspace.service';

@Component({
  selector: 'app-settings-page',
  template: `
    <section class="settings-grid">
      <article class="panel">
        <p class="eyebrow">Poste</p>
        <h1>Runtime desktop</h1>

        <div class="setting-card" *ngIf="runtimeInfo() as runtime; else browserRuntime">
          <div class="setting-head">
            <strong>{{ runtime.platform }}</strong>
            <span class="badge">{{ runtime.packaged ? 'Packaged' : 'Dev' }}</span>
          </div>
          <p>Version {{ runtime.version }} · impression locale directe active</p>
        </div>

        <ng-template #browserRuntime>
          <div class="setting-card">
            <div class="setting-head">
              <strong>Navigateur web</strong>
              <span class="badge">Fallback</span>
            </div>
            <p>Les impressions passent encore par la fenetre d'impression du navigateur.</p>
          </div>
        </ng-template>

        <div class="setting-card" *ngIf="desktopPrinters().length > 0">
          <strong>Imprimantes systeme detectees</strong>
          <p *ngFor="let printer of desktopPrinters()">
            {{ printer.displayName || printer.name }}<br />
            <span class="muted-line">{{ printer.isDefault ? 'Par defaut' : 'Disponible' }}</span>
          </p>
        </div>
      </article>

      <article class="panel">
        <p class="eyebrow">Impression</p>
        <h1>Routage imprimantes</h1>

        <div class="setting-card" *ngFor="let printer of printers()">
          <div class="setting-head">
            <strong>{{ printer.name }}</strong>
            <span class="badge">{{ printer.target }}</span>
          </div>
          <p>{{ printer.protocol }} · {{ printer.queueName }}</p>
          <p class="muted-line">
            Largeur {{ printer.paperWidthMm || 80 }}mm ·
            {{ printer.printMode || 'THERMAL' }} ·
            {{ printer.silent === false ? 'Dialogue visible' : 'Silencieux' }}
          </p>
          <p class="muted-line">
            Routage local:
            {{ printer.systemPrinterName || printer.name || printer.queueName }}
          </p>
          <p class="muted-line">{{ desktopMatch(printer) }}</p>
        </div>
      </article>

      <article class="panel">
        <p class="eyebrow">Synchronisation</p>
        <h1>Visibilite synchro</h1>

        <div class="setting-card" *ngIf="syncStatus() as status">
          <strong>Evenements acceptes</strong>
          <p>{{ status.acceptedEvents }}</p>
          <strong>Doublons</strong>
          <p>{{ status.duplicateEvents }}</p>
          <strong>Conflits en attente</strong>
          <p>{{ status.pendingConflicts }}</p>
        </div>

        <button type="button" (click)="runManualSync()">Lancer la synchro manuelle</button>
      </article>
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
        padding: 22px;
        border-radius: var(--radius-lg);
        border: 1px solid var(--surface-border);
        background: var(--surface);
        box-shadow: var(--shadow-soft);
      }

      .eyebrow {
        color: var(--muted);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      h1 {
        margin-top: 6px;
        font-size: 26px;
      }

      .setting-card {
        margin-top: 16px;
        padding: 18px;
        border-radius: 14px;
        background: var(--surface-raised);
        border: 1px solid var(--surface-border);
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
        padding: 6px 10px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 11px;
        font-weight: 600;
      }

      button {
        margin-top: 16px;
        border: 0;
        border-radius: 12px;
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
      return 'Correspondance systeme indisponible hors mode desktop.';
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
      ? `Correspondance detectee: ${match.displayName || match.name}`
      : 'Aucune imprimante systeme correspondante detectee.';
  }
}
