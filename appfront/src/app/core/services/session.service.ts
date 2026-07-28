import { Injectable, computed, signal } from '@angular/core';
import { AuthUser, BootstrapSession } from '../models/app.models';

@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly accessToken = signal<string | null>(null);
  readonly refreshToken = signal<string | null>(null);
  readonly user = signal<AuthUser | null>(null);
  readonly branch = signal<BootstrapSession | null>(null);

  readonly isAuthenticated = computed(() => !!this.accessToken() && !!this.user());
  readonly displayName = computed(() => this.user()?.displayName ?? 'Guest');
  readonly currentBranchName = computed(() => this.branch()?.branchName ?? 'Aucune succursale');

  setAuth(accessToken: string, refreshToken: string, user: AuthUser): void {
    this.accessToken.set(accessToken);
    this.refreshToken.set(refreshToken);
    this.user.set(user);
  }

  setBranch(branch: BootstrapSession): void {
    this.branch.set(branch);
  }

  clear(): void {
    this.accessToken.set(null);
    this.refreshToken.set(null);
    this.user.set(null);
    this.branch.set(null);
  }
}
