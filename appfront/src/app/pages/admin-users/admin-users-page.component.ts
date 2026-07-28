import { Component, inject } from '@angular/core';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-admin-users-page',
  template: `
    <section class="panel">
      <p class="eyebrow">Administration utilisateurs</p>
      <h1>Perimetre operateur actuel</h1>
      <article class="user-card">
        <strong>{{ session.user()?.displayName }}</strong>
        <p>{{ session.user()?.roles?.join(', ') }}</p>
        <div class="chips">
          <span *ngFor="let permission of session.user()?.permissions">{{ permission }}</span>
        </div>
      </article>
    </section>
  `,
  styles: [
    `
      .panel { padding: 24px; border-radius: 28px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.03); }
      .eyebrow, p { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; }
      .user-card { margin-top: 18px; padding: 18px; border-radius: 18px; background: rgba(255, 255, 255, 0.04); }
      .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
      .chips span { padding: 10px 12px; border-radius: 999px; background: rgba(255, 255, 255, 0.06); color: var(--text); font-size: 12px; }
    `,
  ],
  standalone: false,
})
export class AdminUsersPageComponent {
  protected readonly session = inject(SessionService);
}
