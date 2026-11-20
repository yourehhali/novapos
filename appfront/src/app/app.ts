import { Component, OnInit, inject } from '@angular/core';
import { PocketService } from './core/services/pocket.service';
import { SyncService } from './core/services/sync.service';
import { WebsocketPosService } from './core/services/websocket-pos.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly syncService = inject(SyncService);
  private readonly pocketService = inject(PocketService);
  private readonly websocketPosService = inject(WebsocketPosService);

  ngOnInit(): void {
    this.syncService.startBackgroundSync();
    this.pocketService.init();
    this.websocketPosService.init();
  }
}
