import { Component, inject } from '@angular/core';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-admin-branches-page',
  template: `
    <section class="panel">
      <p class="eyebrow">Administration succursales</p>
      <h1>Succursales assignees</h1>
      <div class="branch-list">
        <article *ngFor="let branch of session.user()?.branchAssignments">
          <strong>{{ branch.branchName }}</strong>
          <p>{{ branch.branchId }}</p>
          <span>{{ branch.defaultDeviceType }}</span>
        </article>
      </div>
    </section>
  `,
  styles: [
    `
      .panel { padding: 24px; border-radius: 28px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.03); }
      .eyebrow, p, span { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; }
      .branch-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 20px; }
      article { padding: 18px; border-radius: 18px; background: rgba(255, 255, 255, 0.04); }
      strong { display: block; margin-bottom: 10px; }
    `,
  ],
  standalone: false,
})
export class AdminBranchesPageComponent {
  protected readonly session = inject(SessionService);
}
