import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  template: `
    <section class="login-shell">
      <article class="hero">
        <div class="hero-header">
          <span class="brand-mark">NP</span>
          <div>
            <p class="eyebrow">POS entreprise pense pour le Maroc</p>
            <h1>Une interface operationnelle faite pour les longues journees caisse.</h1>
          </div>
        </div>

        <div class="hero-copy">
          <p class="lead">
            Un POS offline-first pour restaurants, cafes, boulangeries, retail et groceries.
            L espace de travail continue localement et se synchronise en arriere-plan quand internet revient.
          </p>

          <div class="facts">
            <div class="fact">
              <span>Mode</span>
              <strong>Offline-first</strong>
            </div>
            <div class="fact">
              <span>Marche</span>
              <strong>Maroc</strong>
            </div>
            <div class="fact">
              <span>Utilisateurs</span>
              <strong>8 comptes</strong>
            </div>
          </div>
        </div>
      </article>

      <form class="login-card" (ngSubmit)="submit()">
        <div class="card-header">
          <p class="eyebrow">Acces securise</p>
          <h2>Connexion NovaPOS</h2>
        </div>

        <label>
          Identifiant
          <input [(ngModel)]="login" name="login" placeholder="cashier@novapos.ma" />
        </label>

        <label>
          Mot de passe
          <input [(ngModel)]="password" name="password" type="password" placeholder="Pass123!" />
        </label>

        <button type="submit" [disabled]="loading()">
          {{ loading() ? 'Connexion...' : 'Entrer' }}
        </button>

        <div class="credentials">
          <button type="button" (click)="applyPreset('superadmin@novapos.ma')" class="credential-card">Super Admin</button>
          <button type="button" (click)="applyPreset('owner@novapos.ma')" class="credential-card">Proprietaire</button>
          <button type="button" (click)="applyPreset('manager@novapos.ma')" class="credential-card">Manager</button>
          <button type="button" (click)="applyPreset('cashier@novapos.ma')" class="credential-card">Caissier</button>
          <button type="button" (click)="applyPreset('waiter@novapos.ma')" class="credential-card">Serveur</button>
          <button type="button" (click)="applyPreset('inventory@novapos.ma')" class="credential-card">Stock</button>
          <button type="button" (click)="applyPreset('accountant@novapos.ma')" class="credential-card">Comptable</button>
        </div>

        <p class="hint">Mot de passe de demo pour tous les comptes: <strong>Pass123!</strong></p>
        <p class="error" *ngIf="error()">{{ error() }}</p>
      </form>
    </section>
  `,
  styles: [
    `
      .login-shell {
        min-height: 100vh;
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

  protected login = 'cashier@novapos.ma';
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
      this.error.set('Connexion impossible. Verifiez l API ou utilisez les identifiants de demonstration.');
    } finally {
      this.loading.set(false);
    }
  }
}
