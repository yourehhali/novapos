import { Component, HostListener, inject } from '@angular/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { AppModalService } from '../../../core/services/app-modal.service';

@Component({
  selector: 'app-modal',
  templateUrl: './app-modal.component.html',
  styleUrls: ['./app-modal.component.scss'],
  standalone: false,
})
export class AppModalComponent {
  protected readonly modal = inject(AppModalService);
  protected readonly lang = inject(LanguageService);

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.modal.currentModal()) {
      this.modal.close();
    }
  }

  protected close(): void {
    this.modal.close();
  }
}
