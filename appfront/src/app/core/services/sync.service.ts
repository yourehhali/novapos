import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { ApiService } from './api.service';
import { RoxPosDbService } from '../../offline/RoxPos-db.service';
import { NetworkService } from './network.service';
import { SessionService } from './session.service';
import { LanguageService } from '../i18n/language.service';
import { isOfflineDemoToken } from '../demo/offline-demo.data';

@Injectable({ providedIn: 'root' })
export class SyncService {
  private static readonly SYNC_TIMEOUT_MS = 1500;
  private readonly api = inject(ApiService);
  private readonly db = inject(RoxPosDbService);
  private readonly network = inject(NetworkService);
  private readonly session = inject(SessionService);
  protected readonly lang = inject(LanguageService);
  private scheduledSync: ReturnType<typeof setTimeout> | null = null;
  private periodicSync: ReturnType<typeof setInterval> | null = null;

  readonly syncMessage = signal(this.lang.t('services.pending'));
  readonly syncInFlight = signal(false);

  scheduleSync(delayMs = 0): void {
    if (this.scheduledSync) {
      clearTimeout(this.scheduledSync);
    }

    this.scheduledSync = setTimeout(() => {
      this.scheduledSync = null;
      void this.runSync();
    }, Math.max(0, delayMs));
  }
  startBackgroundSync(): void {
    this.scheduleSync(50);

    if (this.periodicSync) {
      return;
    }

    this.periodicSync = setInterval(() => {
      void this.runSync();
    }, 30000);
  }

  async runSync(): Promise<void> {
    const token = this.session.accessToken();
    const branch = this.session.branch();

    if (!token || !branch || this.syncInFlight()) {
      return;
    }

    if (isOfflineDemoToken(token)) {
      this.syncMessage.set(this.lang.t('services.demoModeLocalEvents'));
      return;
    }

    if (!this.network.isOnline()) {
      return;
    }

    const queue = await this.db.eventQueue
      .where('localStatus')
      .equals('pending')
      .sortBy('deviceSequence');

    if (queue.length === 0) {
      this.syncMessage.set(this.lang.t('services.localQueueSynced'));
      return;
    }

    this.syncInFlight.set(true);
    this.syncMessage.set(this.lang.t('services.syncingPendingEvents', { count: queue.length }));

    try {
      const lastCursor = await this.db.syncCursors.get(branch.deviceCode);
      const response = await firstValueFrom(
        this.api
          .syncEvents(token, {
            branchId: branch.branchId,
            deviceId: branch.deviceCode,
            lastKnownServerCursor: lastCursor?.cursor,
            events: queue,
          })
          .pipe(timeout(SyncService.SYNC_TIMEOUT_MS)),
      );

      await this.db.transaction('rw', this.db.eventQueue, this.db.syncCursors, async () => {
        for (const eventUuid of response.acceptedEventUuids) {
          await this.db.eventQueue.update(eventUuid, {
            localStatus: 'acknowledged',
            status: 'ACKNOWLEDGED',
          });
        }

        for (const eventUuid of response.duplicateEventUuids) {
          await this.db.eventQueue.update(eventUuid, {
            localStatus: 'acknowledged',
            status: 'ACKNOWLEDGED',
          });
        }

        for (const eventUuid of response.conflictedEventUuids) {
          await this.db.eventQueue.update(eventUuid, {
            localStatus: 'conflict',
            status: 'CONFLICT',
          });
        }

        await this.db.syncCursors.put({
          id: branch.deviceCode,
          cursor: response.serverCursor,
        });
      });

      this.syncMessage.set(
        this.lang.t('services.syncAcceptedDuplicates', {
          accepted: response.acceptedEventUuids.length,
          duplicates: response.duplicateEventUuids.length,
        }),
      );
    } catch {
      this.syncMessage.set(this.lang.t('services.syncPaused'));
    } finally {
      this.syncInFlight.set(false);
    }
  }
}
