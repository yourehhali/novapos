import { Injectable, signal } from '@angular/core';

export interface AppModalState {
  title: string;
  message: string;
  details?: string;
}

@Injectable({ providedIn: 'root' })
export class AppModalService {
  private readonly modalState = signal<AppModalState | null>(null);

  readonly currentModal = this.modalState.asReadonly();

  openError(title: string, message: string, details?: string): void {
    this.modalState.set({
      title,
      message,
      details,
    });
  }

  close(): void {
    this.modalState.set(null);
  }
}
