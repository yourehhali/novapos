import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/i18n/language.service';

@Component({
  selector: 'app-login-page',
  template: `
    <section class="login-shell">
      <article class="hero">
        <div class="hero-header">
          <span class="brand-mark">NP</span>
          <div>
            <p class="eyebrow">{{ lang.t('login.tagline') }}</p>
            <h1>{{ lang.t('login.heroTitle') }}</h1>
          </div>
        </div>

        <div class="hero-copy">
          <p class="lead">
            {{ lang.t('login.heroLead') }}
          </p>

          <div class="facts">
            <div class="fact">
              <span>{{ lang.t('login.factMode') }}</span>
              <strong>Offline-first</strong>
            </div>
            <div class="fact">
              <span>{{ lang.t('login.factMarket') }}</span>
              <strong>{{ lang.t('login.factCountry') }}</strong>
            </div>
            <div class="fact">
              <span>{{ lang.t('login.factUsers') }}</span>
              <strong>{{ lang.t('login.factAccounts') }}</strong>
            </div>
          </div>
        </div>
      </article>

      <form class="login-card" (ngSubmit)="submit()">
        <div class="card-header">
          <p class="eyebrow">{{ lang.t('login.secureAccess') }}</p>
          <h2>{{ lang.t('login.title') }}</h2>
        </div>

        <label>
          {{ lang.t('login.identifier') }}
          <input [(ngModel)]="login" name="login" placeholder="cashier@RoxPos.ma" />
        </label>

        <label>
          {{ lang.t('login.password') }}
          <input [(ngModel)]="password" name="password" type="password" placeholder="Pass123!" />
        </label>

        <button type="submit" [disabled]="loading()">
          {{ loading() ? lang.t('login.submitting') : lang.t('login.submit') }}
        </button>

        <div class="credentials">
          <button type="button" (click)="applyPreset('superadmin@RoxPos.ma')" class="credential-card">Super Admin</button>
          <button type="button" (click)="applyPreset('owner@RoxPos.ma')" class="credential-card">{{ lang.t('login.roleOwner') }}</button>
          <button type="button" (click)="applyPreset('manager@RoxPos.ma')" class="credential-card">Manager</button>
          <button type="button" (click)="applyPreset('cashier@RoxPos.ma')" class="credential-card">{{ lang.t('login.roleCashier') }}</button>
          <button type="button" (click)="applyPreset('waiter@RoxPos.ma')" class="credential-card">{{ lang.t('login.roleWaiter') }}</button>
          <button type="button" (click)="applyPreset('inventory@RoxPos.ma')" class="credential-card">{{ lang.t('login.roleStock') }}</button>
          <button type="button" (click)="applyPreset('accountant@RoxPos.ma')" class="credential-card">{{ lang.t('login.roleAccountant') }}</button>
        </div>

        <p class="hint">{{ lang.t('login.demoHint') }} <strong>Pass123!</strong></p>
        <p class="error" *ngIf="error()">{{ error() }}</p>
      </form>
    </section>
  `,
  styles: [
    `
      .login-shell {
        min-height: 100svh;
        display: grid;
        grid-template-columns: 1.15fr 420px;
        gap: 20px;
        padding: 24px;
        background: var(--bg);
      }

      .hero,
      .login-card {
        border: 1px solid var(--surface-border);
        border-radius: 22px;
        background: var(--surface);
        box-shadow: var(--shadow-soft);
      }

      .hero {
        padding: 28px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      .hero-header {
        display: flex;
        gap: 16px;
        align-items: flex-start;
      }

      .brand-mark {
        display: grid;
        place-items: center;
        width: 46px;
        height: 46px;
        border-radius: 12px;
        background: var(--accent);
        color: #041118;
        font-size: 14px;
        font-weight: 700;
      }

      .hero h1 {
        max-width: 14ch;
        margin: 6px 0 0;
        font-size: clamp(34px, 4vw, 54px);
        line-height: 1;
      }

      .lead {
        max-width: 56ch;
        color: var(--muted);
        font-size: 15px;
      }

      .hero-copy {
        display: grid;
        gap: 22px;
      }

      .facts {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      .fact {
        padding: 16px;
        border-radius: 16px;
        background: var(--surface-raised);
      }

      .fact span {
        display: block;
        margin-bottom: 6px;
        color: var(--muted);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .fact strong {
        font-size: 16px;
        font-weight: 600;
      }

      .credential-card,
      button {
        border: 0;
        cursor: pointer;
      }

      .card-header {
        display: grid;
        gap: 6px;
      }

      .credential-card {
        padding: 10px 12px;
        border: 1px solid var(--surface-border);
        border-radius: 10px;
        text-align: center;
        background: #20252a;
        color: var(--muted-strong);
        font-size: 13px;
        font-weight: 500;
      }

      .eyebrow,
      .hint {
        display: block;
        color: var(--muted);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .credentials {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .login-card {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        justify-content: center;
      }

      .login-card h2 {
        margin: 0;
        font-size: 24px;
      }

      label {
        display: grid;
        gap: 8px;
        color: var(--muted);
        font-size: 14px;
      }

      input {
        padding: 14px 15px;
        border-radius: 12px;
        border: 1px solid var(--surface-border);
        background: #20252a;
        color: var(--text);
      }

      button[type='submit'] {
        padding: 14px 18px;
        border-radius: 12px;
        background: var(--accent);
        color: #041118;
        font-weight: 700;
      }

      .credential-card:hover,
      button[type='submit']:hover {
        background: #22ceff;
        color: #041118;
      }

      .error {
        color: #fca5a5;
        font-size: 13px;
      }

      @media (max-width: 1024px) {
        .login-shell {
          grid-template-columns: 1fr;
        }

        .facts,
        .credentials {
          grid-template-columns: 1fr 1fr;
        }
      }
    `,
  ],
  standalone: false,
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly lang = inject(LanguageService);

  protected login = 'cashier@RoxPos.ma';
  protected password = 'Pass123!';
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected applyPreset(login: string): void {
    this.login = login;
    this.password = 'Pass123!';
  }

  protected async submit(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      await this.authService.login(this.login, this.password);
      await this.router.navigateByUrl('/select-branch');
    } catch {
      this.error.set(this.lang.t('login.error'));
    } finally {
      this.loading.set(false);
    }
  }
}
