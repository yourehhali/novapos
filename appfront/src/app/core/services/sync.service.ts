import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { NovaPosDbService } from '../../offline/novapos-db.service';
import { NetworkService } from './network.service';
import { SessionService } from './session.service';
import { isOfflineDemoToken } from '../demo/offline-demo.data';

@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly api = inject(ApiService);
  private readonly db = inject(NovaPosDbService);
  private readonly network = inject(NetworkService);
  private readonly session = inject(SessionService);

  readonly syncMessage = signal('En attente');
  readonly syncInFlight = signal(false);

  async runSync(): Promise<void> {
    const token = this.session.accessToken();
    const branch = this.session.branch();

    if (!token || !branch || this.syncInFlight()) {
      return;
    }

    if (isOfflineDemoToken(token)) {
      this.syncMessage.set('Mode demo local. Les evenements restent sur cet appareil.');
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
      this.syncMessage.set('La file locale est synchronisee');
      return;
    }

    this.syncInFlight.set(true);
    this.syncMessage.set(`Synchronisation de ${queue.length} evenements en attente`);

    try {
      const lastCursor = await this.db.syncCursors.get(branch.deviceCode);
      const response = await firstValueFrom(
        this.api.syncEvents(token, {
          branchId: branch.branchId,
          deviceId: branch.deviceCode,
          lastKnownServerCursor: lastCursor?.cursor,
          events: queue,
        }),
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
        `${response.acceptedEventUuids.length} acceptes, ${response.duplicateEventUuids.length} doublons`,
      );
    } catch {
      this.syncMessage.set('Synchro en pause. La file locale reste securisee sur cet appareil.');
    } finally {
      this.syncInFlight.set(false);
    }
  }
}
