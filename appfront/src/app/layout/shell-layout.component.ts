import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { NetworkService } from '../core/services/network.service';
import { SessionService } from '../core/services/session.service';
import { SyncService } from '../core/services/sync.service';
import { BusinessSettingsService } from '../core/services/business-settings.service';
import { WorkspaceService } from '../core/services/workspace.service';
import { DesktopBridgeService } from '../core/services/desktop-bridge.service';
import { LanguageService } from '../core/i18n/language.service';

@Component({
  selector: 'app-shell-layout',
  template: `
    <div class="shell" [class.sidebar-collapsed]="sidebarCollapsed()">
      <aside class="sidebar" [class.collapsed]="sidebarCollapsed()">
        <button type="button" class="sidebar-toggle" (click)="toggleSidebar()">
          <span>{{ sidebarCollapsed() ? '>' : '<' }}</span>
          <span *ngIf="!sidebarCollapsed()">{{ lang.t('shell.reduce') }}</span>
        </button>

        <div class="brand">
          <span class="brand-mark">{{ brandMark() }}</span>
          <div *ngIf="!sidebarCollapsed()">
            <h1>{{ businessName() }}</h1>
            <p>{{ lang.t('shell.brandSubtitle') }}</p>
          </div>
        </div>

        <nav class="nav">
          <a routerLink="/dashboard" routerLinkActive="active" [attr.title]="sidebarCollapsed() ? lang.t('shell.nav.dashboard') : null">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="9" rx="1.5" />
              <rect x="14" y="3" width="7" height="5" rx="1.5" />
              <rect x="14" y="12" width="7" height="9" rx="1.5" />
              <rect x="3" y="16" width="7" height="5" rx="1.5" />
            </svg>
            <span class="nav-label" *ngIf="!sidebarCollapsed()">{{ lang.t('shell.nav.dashboard') }}</span>
          </a>
          <a routerLink="/pos" routerLinkActive="active" [attr.title]="sidebarCollapsed() ? lang.t('shell.nav.pos') : null">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M7 10h4M13 10h4M7 14h10" />
              <path d="M3 9h18" stroke-width="1.2" opacity="0.5" />
            </svg>
            <span class="nav-label" *ngIf="!sidebarCollapsed()">{{ lang.t('shell.nav.pos') }}</span>
          </a>
          <a routerLink="/service" routerLinkActive="active" [attr.title]="sidebarCollapsed() ? lang.t('shell.nav.service') : null">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <ellipse cx="12" cy="9" rx="6" ry="3" />
              <path d="M6 9v5c0 1.66 2.69 3 6 3s6-1.34 6-3V9" />
              <path d="M12 17v4" />
              <path d="M8 21h8" />
            </svg>
            <span class="nav-label" *ngIf="!sidebarCollapsed()">{{ lang.t('shell.nav.service') }}</span>
          </a>
          <a routerLink="/orders" routerLinkActive="active" [attr.title]="sidebarCollapsed() ? lang.t('shell.nav.orders') : null">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 4h13l3 3v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
              <path d="M17 4v3h3" />
              <path d="M7 12h10M7 16h7" />
            </svg>
            <span class="nav-label" *ngIf="!sidebarCollapsed()">{{ lang.t('shell.nav.orders') }}</span>
          </a>
        </nav>

        <div class="sidebar-divider"></div>

        <nav class="nav nav-secondary">
          <a routerLink="/management" routerLinkActive="active" [attr.title]="sidebarCollapsed() ? lang.t('shell.nav.management') : null">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="7" width="18" height="13" rx="2" />
              <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
              <path d="M3 12.5h18" />
            </svg>
            <span class="nav-label" *ngIf="!sidebarCollapsed()">{{ lang.t('shell.nav.management') }}</span>
          </a>
          <a routerLink="/settings" routerLinkActive="active" [attr.title]="sidebarCollapsed() ? lang.t('shell.nav.settings') : null">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
            <span class="nav-label" *ngIf="!sidebarCollapsed()">{{ lang.t('shell.nav.settings') }}</span>
          </a>
        </nav>

        <div class="language-switch" [class.collapsed]="sidebarCollapsed()">
          <span class="language-label" *ngIf="!sidebarCollapsed()">{{ lang.t('shell.language') }}</span>
          <div class="language-options">
            <button
              type="button"
              class="language-option"
              [class.active]="lang.language() === 'fr'"
              (click)="lang.setLanguage('fr')"
              [attr.title]="lang.t('shell.languageFrench')"
              [attr.aria-label]="lang.t('shell.languageFrench')"
              [attr.aria-pressed]="lang.language() === 'fr'"
            >
              <span class="language-flag">🇫🇷</span>
              <span class="language-code" *ngIf="!sidebarCollapsed()">FR</span>
            </button>
            <button
              type="button"
              class="language-option"
              [class.active]="lang.language() === 'de'"
              (click)="lang.setLanguage('de')"
              [attr.title]="lang.t('shell.languageGerman')"
              [attr.aria-label]="lang.t('shell.languageGerman')"
              [attr.aria-pressed]="lang.language() === 'de'"
            >
              <span class="language-flag">🇩🇪</span>
              <span class="language-code" *ngIf="!sidebarCollapsed()">DE</span>
            </button>
          </div>
        </div>
      </aside>

      <main class="workspace">
        <header class="topbar">
          <div class="topbar-title">
            <p class="eyebrow">{{ lang.t('shell.activeBusiness') }}</p>
            <h2>{{ businessName() }}</h2>
          </div>

          <div class="status-cluster">
            <span class="pill neutral">{{ lang.t('shell.localMode') }}</span>
            <button
              *ngIf="isDesktop()"
              type="button"
              class="exit-button"
              (click)="exitApp()"
              [attr.title]="lang.t('shell.exit')"
              [attr.aria-label]="lang.t('shell.exit')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              <span>{{ lang.t('shell.exit') }}</span>
            </button>
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
        min-height: 100svh;
      }

      .shell {
        display: flex;
        min-height: 100svh;
        background: var(--bg);
      }

      .sidebar {
        position: sticky;
        top: 0;
        align-self: flex-start;
        display: flex;
        flex-direction: column;
        width: 200px;
        height: 100svh;
        overflow-y: auto;
        padding: 14px 12px;
        border-right: 1px solid var(--surface-border);
        background: var(--surface);
        transition: width 0.18s ease, padding 0.18s ease;
      }

      .sidebar.collapsed {
        width: 68px;
        padding: 14px 8px;
      }

      .sidebar-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        margin-bottom: 12px;
        padding: 7px 9px;
        border: 1px solid var(--surface-border);
        border-radius: var(--radius-sm);
        background: var(--surface-soft);
        color: var(--muted-strong);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      }

      .brand {
        display: flex;
        gap: 10px;
        align-items: center;
        margin-bottom: 18px;
        min-height: 34px;
      }

      .sidebar.collapsed .brand {
        justify-content: center;
      }

      .brand h1 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      .brand p,
      .eyebrow {
        margin: 0;
        color: var(--muted);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .brand-mark {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: var(--radius-sm);
        background: var(--accent);
        color: var(--surface);
        box-shadow: var(--shadow-soft);
        font-size: 12px;
        font-weight: 700;
      }

      .nav {
        display: grid;
        gap: 4px;
      }

      .nav a {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        padding: 8px 10px;
        border-radius: var(--radius-sm);
        color: var(--muted-strong);
        background: transparent;
        border: 1px solid transparent;
        font-size: 13px;
        font-weight: 500;
      }

      .nav-icon {
        flex: 0 0 auto;
        width: 16px;
        height: 16px;
        display: block;
      }

      .nav-label {
        display: inline-block;
        white-space: nowrap;
      }

      .sidebar.collapsed .nav a {
        justify-content: center;
        padding: 8px;
        font-size: 11px;
      }

      .sidebar.collapsed .nav-icon {
        width: 18px;
        height: 18px;
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
        margin: 12px 6px;
        background: var(--surface-border);
        opacity: 0.85;
      }

      .sidebar.collapsed .sidebar-divider {
        margin: 12px 2px;
      }

      .nav-secondary a {
        font-size: 12px;
      }

      .language-switch {
        margin-top: auto;
        padding-top: 12px;
        border-top: 1px solid var(--surface-border);
      }

      .language-label {
        display: block;
        margin-bottom: 6px;
        color: var(--muted);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .language-options {
        display: flex;
        gap: 6px;
      }

      .language-option {
        display: inline-flex;
        flex: 1;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 6px 8px;
        border: 1px solid var(--surface-border);
        border-radius: var(--radius-sm);
        background: var(--surface-soft);
        color: var(--muted-strong);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      }

      .language-option:hover {
        color: var(--text);
      }

      .language-option.active {
        color: var(--text);
        border-color: var(--accent);
        background: var(--surface);
      }

      .language-flag {
        font-size: 14px;
        line-height: 1;
      }

      .sidebar.collapsed .language-options {
        flex-direction: column;
      }

      .sidebar.collapsed .language-option {
        padding: 6px;
      }

      .workspace {
        flex: 1;
        min-width: 0;
        padding: 14px 16px 16px;
      }

      .topbar {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        margin-bottom: 14px;
      }

      .topbar h2 {
        margin: 4px 0 0;
        font-size: 20px;
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
        padding: 5px 9px;
        border-radius: 999px;
        border: 1px solid var(--surface-border);
        background: var(--surface);
        color: var(--muted-strong);
        font-size: 11px;
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

      .exit-button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        border-radius: 999px;
        border: 1px solid rgba(238, 107, 107, 0.32);
        background: rgba(238, 107, 107, 0.10);
        color: var(--danger);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      }

      .exit-button svg {
        width: 13px;
        height: 13px;
      }

      .exit-button:hover {
        border-color: rgba(238, 107, 107, 0.55);
        background: rgba(238, 107, 107, 0.18);
      }

      .content {
        min-height: calc(100svh - 90px);
        display: flex;
        flex-direction: column;
      }

      @media (max-width: 900px) {
        .shell {
          flex-direction: column;
        }

        .sidebar {
          position: static;
          align-self: stretch;
          width: auto;
          height: auto;
          overflow-y: visible;
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
export class ShellLayoutComponent implements OnInit, OnDestroy {
  protected readonly session = inject(SessionService);
  protected readonly network = inject(NetworkService);
  protected readonly sync = inject(SyncService);
  protected readonly businessSettingsService = inject(BusinessSettingsService);
  protected readonly workspaceService = inject(WorkspaceService);
  protected readonly desktopBridge = inject(DesktopBridgeService);
  protected readonly lang = inject(LanguageService);
  protected readonly sidebarCollapsed = signal(this.readSidebarPreference());
  protected readonly isDesktop = signal(this.desktopBridge.isDesktop());
  protected readonly storedBusinessName = signal<string | null>(null);
  protected readonly businessName = computed(() => this.storedBusinessName() ?? this.session.user()?.businessName ?? 'Almani Nafris');
  private readonly destroy$ = new Subject<void>();

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

    this.workspaceService.businessSettingsChanged$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async () => {
        try {
          const settings = await this.businessSettingsService.load();
          if (settings?.businessName?.trim()) {
            this.storedBusinessName.set(settings.businessName.trim());
          } else {
            this.storedBusinessName.set(null);
          }
        } catch {
          // ignore
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected toggleSidebar(): void {
    const next = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('RoxPos.sidebar.collapsed', next ? 'true' : 'false');
    }
  }

  protected async exitApp(): Promise<void> {
    await this.desktopBridge.quitApp();
  }

  private readSidebarPreference(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem('RoxPos.sidebar.collapsed') === 'true';
  }
}
