import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NetworkService } from '../core/services/network.service';
import { SessionService } from '../core/services/session.service';
import { SyncService } from '../core/services/sync.service';
import { BusinessSettingsService } from '../core/services/business-settings.service';

@Component({
  selector: 'app-shell-layout',
  template: `
    <div class="shell" [class.sidebar-collapsed]="sidebarCollapsed()">
      <aside class="sidebar" [class.collapsed]="sidebarCollapsed()">
        <button type="button" class="sidebar-toggle" (click)="toggleSidebar()">
          <span>{{ sidebarCollapsed() ? '>' : '<' }}</span>
          <span *ngIf="!sidebarCollapsed()">Reduire</span>
        </button>

        <div class="brand">
          <span class="brand-mark">{{ brandMark() }}</span>
          <div *ngIf="!sidebarCollapsed()">
            <h1>{{ businessName() }}</h1>
            <p>POS local</p>
          </div>
        </div>

        <nav class="nav">
          <a routerLink="/dashboard" routerLinkActive="active" [attr.title]="sidebarCollapsed() ? 'Tableau de bord' : null">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="9" rx="1.5" />
              <rect x="14" y="3" width="7" height="5" rx="1.5" />
              <rect x="14" y="12" width="7" height="9" rx="1.5" />
              <rect x="3" y="16" width="7" height="5" rx="1.5" />
            </svg>
            <span class="nav-label" *ngIf="!sidebarCollapsed()">Tableau de bord</span>
          </a>
          <a routerLink="/pos" routerLinkActive="active" [attr.title]="sidebarCollapsed() ? 'POS' : null">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M7 10h4M13 10h4M7 14h10" />
              <path d="M3 9h18" stroke-width="1.2" opacity="0.5" />
            </svg>
            <span class="nav-label" *ngIf="!sidebarCollapsed()">POS</span>
          </a>
          <a routerLink="/orders" routerLinkActive="active" [attr.title]="sidebarCollapsed() ? 'Historique' : null">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 4h13l3 3v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
              <path d="M17 4v3h3" />
              <path d="M7 12h10M7 16h7" />
            </svg>
            <span class="nav-label" *ngIf="!sidebarCollapsed()">Historique</span>
          </a>
        </nav>

        <div class="sidebar-divider"></div>

        <nav class="nav nav-secondary">
          <a routerLink="/management" routerLinkActive="active" [attr.title]="sidebarCollapsed() ? 'Gestion' : null">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14.7 6.3a4 4 0 0 1 0 5.66l-.3.3a4 4 0 0 1 0 5.66 1 1 0 0 1-1.41 0l-2.83-2.83a1 1 0 0 1 0-1.41l1.42-1.42M9.3 17.7a4 4 0 0 1 0-5.66l.3-.3a4 4 0 0 1 0-5.66 1 1 0 0 1 1.41 0l2.83 2.83a1 1 0 0 1 0 1.41l-1.42 1.42" />
              <circle cx="12" cy="12" r="2.2" />
            </svg>
            <span class="nav-label" *ngIf="!sidebarCollapsed()">Gestion</span>
          </a>
        </nav>
      </aside>

      <main class="workspace">
        <header class="topbar">
          <div class="topbar-title">
            <p class="eyebrow">Entreprise active</p>
            <h2>{{ businessName() }}</h2>
          </div>

          <div class="status-cluster">
            <span class="pill neutral">Mode local</span>
          </div>
        </header>

        <section class="content">
          <router-outlet></router-outlet>
        </section>
      </main>

      <app-modal></app-modal>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
      }

      .shell {
        display: flex;
        min-height: 100vh;
        background: var(--bg);
      }

      .sidebar {
        width: 248px;
        padding: 18px 14px;
        border-right: 1px solid var(--surface-border);
        background: var(--surface);
        transition: width 0.18s ease, padding 0.18s ease;
      }

      .sidebar.collapsed {
        width: 88px;
        padding: 18px 10px;
      }

      .sidebar-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        margin-bottom: 14px;
        padding: 8px 10px;
        border: 1px solid var(--surface-border);
        border-radius: var(--radius-sm);
        background: var(--surface-soft);
        color: var(--muted-strong);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }

      .brand {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 22px;
        min-height: 42px;
      }

      .sidebar.collapsed .brand {
        justify-content: center;
      }

      .brand h1 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }

      .brand p,
      .eyebrow {
        margin: 0;
        color: var(--muted);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .brand-mark {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: var(--radius-sm);
        background: var(--accent);
        color: var(--surface);
        box-shadow: var(--shadow-soft);
        font-size: 13px;
        font-weight: 700;
      }

      .nav {
        display: grid;
        gap: 6px;
      }

      .nav a {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        color: var(--muted-strong);
        background: transparent;
        border: 1px solid transparent;
        font-size: 14px;
        font-weight: 500;
      }

      .nav-icon {
        flex: 0 0 auto;
        width: 18px;
        height: 18px;
        display: block;
      }

      .nav-label {
        display: inline-block;
        white-space: nowrap;
      }

      .sidebar.collapsed .nav a {
        justify-content: center;
        padding: 10px;
        font-size: 12px;
      }

      .sidebar.collapsed .nav-icon {
        width: 20px;
        height: 20px;
      }

      .nav a:hover {
        color: var(--text);
        background: var(--surface-soft);
      }

      .nav a.active {
        color: var(--text);
        border-color: var(--surface-border);
        background: var(--surface-soft);
      }

      .sidebar-divider {
        height: 1px;
        margin: 16px 6px;
        background: var(--surface-border);
        opacity: 0.85;
      }

      .sidebar.collapsed .sidebar-divider {
        margin: 16px 2px;
      }

      .nav-secondary a {
        font-size: 13px;
      }

      .workspace {
        flex: 1;
        min-width: 0;
        padding: 18px 20px 20px;
      }

      .topbar {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        margin-bottom: 18px;
      }

      .topbar h2 {
        margin: 4px 0 0;
        font-size: 24px;
        font-weight: 600;
      }

      .topbar-title {
        min-width: 0;
      }

      .status-cluster {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid var(--surface-border);
        background: var(--surface);
        color: var(--muted-strong);
        font-size: 12px;
      }

      .pill.online {
        border-color: rgba(78, 203, 133, 0.28);
        background: rgba(78, 203, 133, 0.10);
        color: var(--success);
      }

      .pill.offline {
        border-color: rgba(229, 182, 82, 0.28);
        background: rgba(229, 182, 82, 0.10);
        color: var(--warning);
      }

      .pill.neutral {
        color: var(--muted-strong);
      }

      .content {
        min-height: calc(100vh - 90px);
      }

      @media (max-width: 1100px) {
        .shell {
          flex-direction: column;
        }

        .sidebar {
          width: auto;
          border-right: 0;
          border-bottom: 1px solid var(--surface-border);
        }

        .sidebar.collapsed {
          width: auto;
          padding: 18px 14px;
        }

        .topbar {
          flex-direction: column;
          align-items: flex-start;
        }

        .status-cluster {
          justify-content: flex-start;
        }
      }
    `,
  ],
  standalone: false,
})
export class ShellLayoutComponent implements OnInit {
  protected readonly session = inject(SessionService);
  protected readonly network = inject(NetworkService);
  protected readonly sync = inject(SyncService);
  protected readonly businessSettingsService = inject(BusinessSettingsService);
  protected readonly sidebarCollapsed = signal(this.readSidebarPreference());
  protected readonly storedBusinessName = signal<string | null>(null);
  protected readonly businessName = computed(() => this.storedBusinessName() ?? this.session.user()?.businessName ?? 'Hole Mole');
  protected readonly brandMark = computed(() => {
    const name = this.businessName()?.trim() ?? '';
    if (!name) return 'HM';
    const words = name.split(/\s+/).filter(Boolean).slice(0, 2);
    const initials = words.map((w) => w[0]?.toUpperCase() ?? '').join('');
    return (initials || name.slice(0, 2)).slice(0, 2);
  });

  async ngOnInit(): Promise<void> {
    try {
      const settings = await this.businessSettingsService.load();
      if (settings?.businessName?.trim()) {
        this.storedBusinessName.set(settings.businessName.trim());
      }
    } catch {
      // ignore, fall back to session or default
    }
  }

  protected toggleSidebar(): void {
    const next = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('novapos.sidebar.collapsed', next ? 'true' : 'false');
    }
  }

  private readSidebarPreference(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem('novapos.sidebar.collapsed') === 'true';
  }
}
