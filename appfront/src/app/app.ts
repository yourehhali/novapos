import { Component, OnInit, inject } from '@angular/core';
import { PocketService } from './core/services/pocket.service';
import { SyncService } from './core/services/sync.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly syncService = inject(SyncService);
  private readonly pocketService = inject(PocketService);

  ngOnInit(): void {
    this.syncService.startBackgroundSync();
    this.pocketService.init();
  }
}
