import { Component, OnInit, inject, signal } from '@angular/core';
import { DashboardSummary, SyncStatus } from '../../core/models/app.models';
import { PosService } from '../../core/services/pos.service';
import { WorkspaceService } from '../../core/services/workspace.service';

@Component({
  selector: 'app-dashboard-page',
  template: `
    <section class="dashboard">
      <header class="page-header">
        <div>
          <p class="eyebrow">Vue operationnelle succursale</p>
          <h1>Resume des operations</h1>
        </div>
      </header>

      <div class="metrics">
        <article class="metric-card">
          <span>Commandes actives</span>
          <strong>{{ summary()?.activeOrders ?? 0 }}</strong>
        </article>
        <article class="metric-card">
          <span>Chiffre du jour</span>
          <strong>{{ summary()?.revenueToday ?? 0 | number: '1.2-2' }} MAD</strong>
        </article>
        <article class="metric-card accent">
          <span>Evenements en file</span>
          <strong>{{ pendingQueueDepth() }}</strong>
        </article>
      </div>

      <div class="panel-grid">
        <article class="panel">
          <h2>Notes operationnelles</h2>
          <ul>
            <li *ngFor="let note of summary()?.operationalNotes || []">{{ note }}</li>
          </ul>
        </article>

        <article class="panel">
          <h2>Etat de synchronisation</h2>
          <p>Evenements acceptes: {{ syncStatus()?.acceptedEvents ?? 0 }}</p>
          <p>Doublons detectes: {{ syncStatus()?.duplicateEvents ?? 0 }}</p>
          <p>Conflits en attente: {{ syncStatus()?.pendingConflicts ?? 0 }}</p>
          <p>Derniere synchro: {{ summary()?.lastSuccessfulSyncAt || 'En attente' }}</p>
        </article>
      </div>
    </section>
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

      .metric-card strong {
        display: block;
        margin-top: 8px;
        font-size: 28px;
        color: var(--text);
      }

      .metric-card.accent {
        border-color: rgba(20, 200, 255, 0.22);
        background: linear-gradient(180deg, var(--accent-soft), rgba(20, 200, 255, 0.06));
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

      @media (max-width: 1000px) {
        .metrics,
        .panel-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  standalone: false,
})
export class DashboardPageComponent implements OnInit {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly posService = inject(PosService);

  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly syncStatus = signal<SyncStatus | null>(null);
  protected readonly pendingQueueDepth = signal(0);

  async ngOnInit(): Promise<void> {
    const [summary, syncStatus, pendingQueueDepth] = await Promise.all([
      this.workspaceService.loadDashboard(),
      this.workspaceService.loadSyncStatus(),
      this.posService.getPendingQueueDepth(),
    ]);

    this.summary.set(summary);
    this.syncStatus.set(syncStatus);
    this.pendingQueueDepth.set(pendingQueueDepth);
  }
}
