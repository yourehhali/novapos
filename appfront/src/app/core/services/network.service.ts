import { Injectable, NgZone, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NetworkService {
  readonly isOnline = signal<boolean>(navigator.onLine);
  readonly lastTransitionAt = signal<string>(new Date().toISOString());

  constructor(private readonly zone: NgZone) {
    window.addEventListener('online', () => {
      this.zone.run(() => {
        this.isOnline.set(true);
        this.lastTransitionAt.set(new Date().toISOString());
      });
    });

    window.addEventListener('offline', () => {
      this.zone.run(() => {
        this.isOnline.set(false);
        this.lastTransitionAt.set(new Date().toISOString());
      });
    });
  }
}
