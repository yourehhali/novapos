import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { ApiService } from './api.service';
import { SessionService } from './session.service';
import { NovaPosDbService } from '../../offline/novapos-db.service';
import { AuthSessionResponse, BootstrapSession } from '../models/app.models';
import {
  getDefaultOfflineAuthSession,
  getDefaultOfflineBootstrapSession,
  getOfflineBootstrapSession,
  getOfflineDemoAuthSession,
} from '../demo/offline-demo.data';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private static readonly AUTH_TIMEOUT_MS = 1200;
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly db = inject(NovaPosDbService);

  async login(login: string, password: string): Promise<AuthSessionResponse> {
    let response: AuthSessionResponse;

    try {
      response = await firstValueFrom(
        this.api.login(login, password).pipe(timeout(AuthService.AUTH_TIMEOUT_MS)),
      );
    } catch {
      const offlineResponse = getOfflineDemoAuthSession(login, password);
      if (!offlineResponse) {
        throw new Error('Offline login is only available for demo accounts.');
      }
      response = offlineResponse;
    }

    this.session.setAuth(response.accessToken, response.refreshToken, response.user);

    await this.db.sessionContext.put({
      id: 'current',
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      user: JSON.stringify(response.user),
    });

    return response;
  }

  async restoreSession(): Promise<boolean> {
    const cached = await this.db.sessionContext.get('current');
    const defaultSession = getDefaultOfflineAuthSession();

    if (!cached) {
      await this.seedDefaultOfflineSession();
      return true;
    }

    this.session.setAuth(
      defaultSession.accessToken,
      defaultSession.refreshToken,
      defaultSession.user,
    );

    await this.db.sessionContext.put({
      ...cached,
      accessToken: defaultSession.accessToken,
      refreshToken: defaultSession.refreshToken,
      user: JSON.stringify(defaultSession.user),
    });

    if (cached.branchId) {
      const branch = await this.db.bootstrapSessions.get(cached.branchId);
      if (branch) {
        this.session.setBranch(branch);
      } else {
        await this.ensureDefaultBranchBinding();
      }
    } else {
      await this.ensureDefaultBranchBinding();
    }

    return true;
  }

  async bindBranch(branchId: string, deviceType: string, deviceCode?: string): Promise<void> {
    const token = this.session.accessToken();
    if (!token) {
      throw new Error('Missing access token');
    }

    let branch: BootstrapSession;
    try {
      branch = await firstValueFrom(
        this.api
          .bootstrapSession(token, branchId, deviceType, deviceCode)
          .pipe(timeout(AuthService.AUTH_TIMEOUT_MS)),
      );
    } catch {
      const offlineBranch = getOfflineBootstrapSession(branchId, deviceType, deviceCode);
      if (!offlineBranch) {
        throw new Error('Offline branch bootstrap is unavailable for this branch.');
      }
      branch = offlineBranch;
    }

    this.session.setBranch(branch);
    await this.db.bootstrapSessions.put(branch);

    await this.db.sessionContext.update('current', {
      branchId: branch.branchId,
      branchName: branch.branchName,
      deviceCode: branch.deviceCode,
      deviceType: branch.deviceType,
    });
  }

  async logout(): Promise<void> {
    this.session.clear();
    await this.db.sessionContext.clear();
  }

  private async seedDefaultOfflineSession(): Promise<void> {
    const response = getDefaultOfflineAuthSession();
    const branch = getDefaultOfflineBootstrapSession();

    this.session.setAuth(response.accessToken, response.refreshToken, response.user);
    this.session.setBranch(branch);

    await this.db.bootstrapSessions.put(branch);
    await this.db.sessionContext.put({
      id: 'current',
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      user: JSON.stringify(response.user),
      branchId: branch.branchId,
      branchName: branch.branchName,
      deviceCode: branch.deviceCode,
      deviceType: branch.deviceType,
    });
  }

  private async ensureDefaultBranchBinding(): Promise<void> {
    const branch = getDefaultOfflineBootstrapSession();
    this.session.setBranch(branch);
    await this.db.bootstrapSessions.put(branch);
    await this.db.sessionContext.update('current', {
      branchId: branch.branchId,
      branchName: branch.branchName,
      deviceCode: branch.deviceCode,
      deviceType: branch.deviceType,
    });
  }
}
