import { Component, computed, inject, signal } from '@angular/core';
import { NetworkService } from '../core/services/network.service';
import { SessionService } from '../core/services/session.service';
import { SyncService } from '../core/services/sync.service';

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
          <span class="brand-mark">NP</span>
          <div *ngIf="!sidebarCollapsed()">
            <h1>NovaPOS</h1>
            <p>Offline-first operations</p>
          </div>
        </div>

        <nav class="nav">
          <a routerLink="/dashboard" routerLinkActive="active" [attr.title]="sidebarCollapsed() ? 'Tableau de bord' : null">
            {{ sidebarCollapsed() ? 'TB' : 'Tableau de bord' }}
          </a>
          <a routerLink="/pos" routerLinkActive="active" [attr.title]="sidebarCollapsed() ? 'POS' : null">
            POS
          </a>
          <a routerLink="/orders" routerLinkActive="active" [attr.title]="sidebarCollapsed() ? 'Historique' : null">
            {{ sidebarCollapsed() ? 'His' : 'Historique' }}
          </a>
          <a routerLink="/settings" routerLinkActive="active" [attr.title]="sidebarCollapsed() ? 'Parametres' : null">
            {{ sidebarCollapsed() ? 'Cfg' : 'Parametres' }}
          </a>
          <a routerLink="/admin/business" routerLinkActive="active" [attr.title]="sidebarCollapsed() ? 'Entreprise' : null">
            {{ sidebarCollapsed() ? 'Ent' : 'Entreprise' }}
          </a>
          <a routerLink="/admin/branches" routerLinkActive="active" [attr.title]="sidebarCollapsed() ? 'Succursales' : null">
            {{ sidebarCollapsed() ? 'Suc' : 'Succursales' }}
          </a>
          <a routerLink="/admin/users" routerLinkActive="active" [attr.title]="sidebarCollapsed() ? 'Utilisateurs' : null">
            {{ sidebarCollapsed() ? 'Usr' : 'Utilisateurs' }}
          </a>
        </nav>
      </aside>

      <main class="workspace">
        <header class="topbar">
          <div class="topbar-title">
            <p class="eyebrow">Succursale active</p>
            <h2>{{ session.currentBranchName() }}</h2>
          </div>

          <div class="status-cluster">
            <span class="pill" [class.online]="network.isOnline()" [class.offline]="!network.isOnline()">
              {{ network.isOnline() ? 'En ligne' : 'Hors ligne' }}
            </span>
            <span class="pill neutral">Appareil {{ session.branch()?.deviceCode || 'En attente' }}</span>
            <span class="pill neutral">{{ sync.syncMessage() }}</span>
            <span class="pill neutral">{{ welcomeLine() }}</span>
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
        padding: 22px 18px;
        border-right: 1px solid var(--surface-border);
        background: #0d1217;
        transition: width 0.18s ease, padding 0.18s ease;
      }

      .sidebar.collapsed {
        width: 88px;
        padding: 22px 12px;
      }

      .sidebar-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        margin-bottom: 18px;
        padding: 10px 12px;
        border: 1px solid var(--surface-border);
        border-radius: 12px;
        background: var(--surface);
        color: var(--muted-strong);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }

      .brand {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 28px;
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
        width: 42px;
        height: 42px;
        border-radius: 12px;
        background: var(--accent);
        color: #041118;
        box-shadow: var(--shadow-soft);
        font-size: 13px;
        font-weight: 700;
      }

      .nav {
        display: grid;
        gap: 8px;
      }

      .nav a {
        padding: 12px 14px;
        border-radius: 12px;
        color: var(--muted-strong);
        background: transparent;
        border: 1px solid transparent;
        font-size: 14px;
        font-weight: 500;
      }

      .sidebar.collapsed .nav a {
        text-align: center;
        padding: 12px 8px;
        font-size: 12px;
      }

      .nav a:hover {
        color: var(--text);
        background: rgba(255, 255, 255, 0.04);
      }

      .nav a.active {
        color: var(--text);
        border-color: rgba(20, 200, 255, 0.28);
        background: var(--accent-soft);
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
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid var(--surface-border);
        background: var(--surface);
        color: var(--muted-strong);
        font-size: 12px;
      }

      .pill.online {
        border-color: rgba(39, 194, 129, 0.18);
        background: rgba(39, 194, 129, 0.12);
        color: #8ce2bc;
      }

      .pill.offline {
        border-color: rgba(240, 178, 79, 0.18);
        background: rgba(240, 178, 79, 0.12);
        color: #f4c77c;
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
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .sidebar.collapsed {
          width: auto;
          padding: 22px 18px;
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
export class ShellLayoutComponent {
  protected readonly session = inject(SessionService);
  protected readonly network = inject(NetworkService);
  protected readonly sync = inject(SyncService);
  protected readonly sidebarCollapsed = signal(this.readSidebarPreference());
  protected readonly welcomeLine = computed(() => `${this.session.displayName()} pret`);

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
