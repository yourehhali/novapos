import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { PocketServerStatus } from '../../../core/models/app.models';
import { LanguageService } from '../../../core/i18n/language.service';
import { DesktopBridgeService } from '../../../core/services/desktop-bridge.service';
import { PocketService } from '../../../core/services/pocket.service';

@Component({
  selector: 'app-pocket-panel',
  templateUrl: './pocket-panel.component.html',
  styleUrls: ['./pocket-panel.component.scss'],
  standalone: false,
})
export class PocketPanelComponent implements OnInit, OnDestroy {
  private readonly bridge = inject(DesktopBridgeService);
  private readonly pocket = inject(PocketService);
  protected readonly lang = inject(LanguageService);

  protected readonly isDesktop = signal(false);
  protected readonly status = signal<PocketServerStatus | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly running = computed(() => this.status()?.running ?? false);
  private unsubscribe: (() => void) | null = null;

  async ngOnInit(): Promise<void> {
    this.isDesktop.set(this.bridge.isDesktop());
    if (!this.isDesktop()) {
      return;
    }

    this.unsubscribe = this.bridge.onPocketStatus((status) => this.status.set(status));
    this.status.set(await this.pocket.getStatus());
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }

  protected async toggle(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const status = this.running()
        ? await this.pocket.stopServer()
        : await this.pocket.startServer();
      this.status.set(status);
    } catch (caught) {
      this.error.set(caught instanceof Error ? caught.message : this.lang.t('settings.pocket.error'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async regenerate(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      this.status.set(await this.pocket.regeneratePin());
    } catch (caught) {
      this.error.set(caught instanceof Error ? caught.message : this.lang.t('settings.pocket.error'));
    } finally {
      this.busy.set(false);
    }
  }

  protected lastSeen(value: string): string {
    return new Date(value).toLocaleString(this.lang.isFrench() ? 'fr-FR' : 'de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  }
}
