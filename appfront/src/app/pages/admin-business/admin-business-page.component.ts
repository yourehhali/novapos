import { Component, inject } from '@angular/core';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-admin-business-page',
  template: `
    <section class="panel">
      <p class="eyebrow">Administration entreprise</p>
      <h1>{{ session.user()?.businessName }}</h1>
      <div class="detail-grid">
        <article>
          <span>Tenant ID</span>
          <strong>{{ session.user()?.tenantId }}</strong>
        </article>
        <article>
          <span>Roles</span>
          <strong>{{ session.user()?.roles?.join(', ') }}</strong>
        </article>
        <article>
          <span>Operateur</span>
          <strong>{{ session.user()?.displayName }}</strong>
        </article>
      </div>
    </section>
  `,
  styles: [
    `
      .panel {
        padding: 24px;
        border-radius: 28px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.03);
      }
      .eyebrow, span { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; }
      .detail-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 20px; }
      article { padding: 18px; border-radius: 18px; background: rgba(255, 255, 255, 0.04); }
      strong { display: block; margin-top: 10px; }
    `,
  ],
  standalone: false,
})
export class AdminBusinessPageComponent {
  protected readonly session = inject(SessionService);
}
