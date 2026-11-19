import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LanguageService } from '../../core/i18n/language.service';
import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';
import { WorkspaceService } from '../../core/services/workspace.service';

@Component({
  selector: 'app-branch-select-page',
  template: `
    <section class="select-shell">
      <header>
        <p class="eyebrow">{{ lang.t('branch.eyebrow') }}</p>
        <h1>{{ lang.t('branch.title') }}</h1>
        <p class="lead">{{ lang.t('branch.lead') }}</p>
      </header>

      <div class="panel-grid">
        <article class="panel">
          <h2>{{ lang.t('branch.assignedBranches') }}</h2>

          <button
            *ngFor="let branch of session.user()?.branchAssignments"
            type="button"
            class="branch-card"
            [class.active]="selectedBranchId() === branch.branchId"
            (click)="selectedBranchId.set(branch.branchId)"
          >
            <span class="branch-name">{{ branch.branchName }}</span>
            <strong>{{ branch.defaultDeviceType }}</strong>
          </button>
        </article>

        <form class="panel" (ngSubmit)="continueToWorkspace()">
          <h2>{{ lang.t('branch.deviceLink') }}</h2>

          <label>
            {{ lang.t('branch.deviceType') }}
            <select [(ngModel)]="deviceType" name="deviceType">
              <option value="POS_TERMINAL">POS_TERMINAL</option>
              <option value="TABLET">TABLET</option>
              <option value="KIOSK">KIOSK</option>
            </select>
          </label>

          <label>
            {{ lang.t('branch.deviceCode') }}
            <input
              [(ngModel)]="deviceCode"
              name="deviceCode"
              [attr.placeholder]="lang.t('branch.deviceCodePlaceholder')"
            />
          </label>

          <button type="submit" [disabled]="loading() || !selectedBranchId()">
            {{ loading() ? lang.t('branch.preparing') : lang.t('branch.loadWorkspace') }}
          </button>
        </form>
      </div>
    </section>
  `,
  styles: [
    `
      .select-shell {
        max-width: 1240px;
        margin: 0 auto;
      }

      .eyebrow {
        color: var(--muted);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      h1 {
        margin-top: 6px;
        font-size: 32px;
      }

      .lead {
        margin-top: 10px;
        max-width: 60ch;
        color: var(--muted);
      }

      .panel-grid {
        display: grid;
        grid-template-columns: 1.3fr 0.9fr;
        gap: 18px;
        margin-top: 18px;
      }

      .panel {
        padding: 22px;
        border-radius: var(--radius-lg);
        border: 1px solid var(--surface-border);
        background: var(--surface);
        box-shadow: var(--shadow-soft);
      }

      .branch-card {
        width: 100%;
        margin-top: 12px;
        padding: 16px;
        border: 1px solid var(--surface-border);
        border-radius: 14px;
        background: var(--surface-raised);
        color: var(--text);
        text-align: left;
        cursor: pointer;
      }

      .branch-card.active {
        border-color: rgba(20, 200, 255, 0.28);
        background: var(--accent-soft);
      }

      .branch-card span,
      .branch-card strong {
        display: block;
      }

      .branch-name {
        font-size: 16px;
        font-weight: 600;
      }

      .branch-card strong {
        margin-top: 8px;
        color: var(--muted-strong);
        font-size: 13px;
      }

      form {
        display: grid;
        gap: 16px;
      }

      label {
        display: grid;
        gap: 8px;
        color: var(--muted);
      }

      select,
      input,
      button {
        border-radius: 12px;
        padding: 13px 15px;
      }

      select,
      input {
        border: 1px solid var(--surface-border);
        background: #20252a;
        color: var(--text);
      }

      button[type='submit'] {
        border: 0;
        background: var(--accent);
        color: #041118;
        font-weight: 700;
        cursor: pointer;
      }

      @media (max-width: 1000px) {
        .panel-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  standalone: false,
})
export class BranchSelectPageComponent {
  private readonly authService = inject(AuthService);
  private readonly workspaceService = inject(WorkspaceService);
  private readonly router = inject(Router);

  protected readonly session = inject(SessionService);
  protected readonly lang = inject(LanguageService);
  protected readonly loading = signal(false);
  protected readonly selectedBranchId = signal(
    this.session.user()?.branchAssignments[0]?.branchId ?? '',
  );
  protected deviceType = 'POS_TERMINAL';
  protected deviceCode = '';

  protected async continueToWorkspace(): Promise<void> {
    this.loading.set(true);

    try {
      await this.authService.bindBranch(this.selectedBranchId(), this.deviceType, this.deviceCode || undefined);
      void this.warmWorkspaceCache();
      await this.router.navigateByUrl('/dashboard');
    } finally {
      this.loading.set(false);
    }
  }

  private async warmWorkspaceCache(): Promise<void> {
    try {
      await Promise.all([
        this.workspaceService.loadCatalog(),
        this.workspaceService.loadDashboard(),
        this.workspaceService.loadPrinters(),
        this.workspaceService.loadSyncStatus(),
      ]);
    } catch {
      // Navigation already continues with local data; cache warming is best effort only.
    }
  }
}
