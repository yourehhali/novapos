import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import {
  PosWsClientStatus,
  PosWsConfigPatch,
  PosWsConfigView,
  PosWsConnectionState,
  PosWsLogEntry,
} from '../../../core/models/app.models';
import { LanguageService } from '../../../core/i18n/language.service';
import { DesktopBridgeService } from '../../../core/services/desktop-bridge.service';
import { WebsocketPosService } from '../../../core/services/websocket-pos.service';

const TRANSPORT_LOG_LIMIT = 50;
const LOG_VIEW_LIMIT = 20;

function stateKey(state: PosWsConnectionState | undefined): string {
  switch (state) {
    case 'CONNECTED':
      return 'connected';
    case 'CONNECTING':
      return 'connecting';
    case 'SYNCHRONIZING':
      return 'synchronizing';
    case 'AUTH_ERROR':
      return 'authError';
    default:
      return 'disconnected';
  }
}

@Component({
  selector: 'app-pos-ws-panel',
  templateUrl: './pos-ws-panel.component.html',
  styleUrls: ['./pos-ws-panel.component.scss'],
  standalone: false,
})
export class PosWsPanelComponent implements OnInit, OnDestroy {
  private readonly bridge = inject(DesktopBridgeService);
  private readonly ws = inject(WebsocketPosService);
  protected readonly lang = inject(LanguageService);

  protected readonly isDesktop = signal(false);
  protected readonly config = signal<PosWsConfigView | null>(null);
  protected readonly status = signal<PosWsClientStatus | null>(null);
  protected readonly transportLogs = signal<PosWsLogEntry[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly urlDraft = signal('');
  protected readonly deviceDraft = signal('');
  protected readonly tokenDraft = signal('');

  protected readonly enabled = computed(() => this.config()?.enabled ?? false);
  protected readonly hasToken = computed(() => this.config()?.hasToken ?? false);

  private unsubscribeStatus: (() => void) | null = null;
  private unsubscribeLog: (() => void) | null = null;

  async ngOnInit(): Promise<void> {
    this.isDesktop.set(this.bridge.isDesktop());
    if (!this.isDesktop()) {
      return;
    }

    this.unsubscribeStatus = this.bridge.onWsStatus((status) => this.status.set(status));
    this.unsubscribeLog = this.bridge.onWsLog((entry) =>
      this.transportLogs.set([entry, ...this.transportLogs()].slice(0, TRANSPORT_LOG_LIMIT)),
    );

    await this.refreshConfig();
    // `getTransportLogs()` returns the main-process buffer oldest-first.
    // Reverse it so newest entries are on top, then keep only the recent window
    // so old log lines are replaced by new ones instead of stacking up forever.
    const history = await this.ws.getTransportLogs();
    this.transportLogs.set([...history].reverse().slice(0, TRANSPORT_LOG_LIMIT));
  }

  ngOnDestroy(): void {
    this.unsubscribeStatus?.();
    this.unsubscribeLog?.();
  }

  protected combinedLogs(): PosWsLogEntry[] {
    return [...this.ws.processingLogs(), ...this.transportLogs()]
      .sort((left, right) => right.at.localeCompare(left.at))
      .slice(0, LOG_VIEW_LIMIT);
  }

  protected stateLabel(): string {
    return this.lang.t(`settings.posws.state.${stateKey(this.status()?.state)}`);
  }

  protected stateOn(): boolean {
    const state = this.status()?.state;
    return state === 'CONNECTED' || state === 'SYNCHRONIZING';
  }

  protected toggleEnabled(): Promise<void> {
    const next = !this.enabled();
    return this.run(async () => {
      this.status.set(await this.ws.updateConfig({ enabled: next }));
      await this.refreshConfig();
    });
  }

  protected saveConnection(): Promise<void> {
    const patch: PosWsConfigPatch = {
      url: this.urlDraft().trim(),
      deviceId: this.deviceDraft().trim() || null,
    };
    const token = this.tokenDraft().trim();
    if (token) {
      patch.token = token;
    }

    return this.run(async () => {
      this.status.set(await this.ws.updateConfig(patch));
      this.tokenDraft.set('');
      await this.refreshConfig();
    });
  }

  protected connect(): Promise<void> {
    return this.run(async () => {
      this.status.set(await this.ws.connect());
    });
  }

  protected disconnect(): Promise<void> {
    return this.run(async () => {
      this.status.set(await this.ws.disconnect());
    });
  }

  protected formatTime(value: string): string {
    return new Date(value).toLocaleTimeString(this.lang.isFrench() ? 'fr-FR' : 'de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  private async refreshConfig(): Promise<void> {
    const config = await this.ws.getConfig();
    this.config.set(config);
    if (!config) {
      return;
    }
    this.urlDraft.set(config.url);
    this.deviceDraft.set(config.deviceId ?? '');
    this.status.set(config.status);
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (caught) {
      this.error.set(caught instanceof Error ? caught.message : this.lang.t('settings.posws.error'));
    } finally {
      this.busy.set(false);
    }
  }
}
