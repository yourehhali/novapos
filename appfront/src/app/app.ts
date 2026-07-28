import { Component, OnInit, inject } from '@angular/core';
import { SyncService } from './core/services/sync.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly syncService = inject(SyncService);

  async ngOnInit(): Promise<void> {
    await this.syncService.runSync();
  }
}
