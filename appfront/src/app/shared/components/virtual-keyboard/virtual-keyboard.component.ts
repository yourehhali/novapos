import { Component, HostListener, inject } from '@angular/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { VirtualKeyboardKey, VirtualKeyboardService } from '../../../core/services/virtual-keyboard.service';

@Component({
  selector: 'app-virtual-keyboard',
  templateUrl: './virtual-keyboard.component.html',
  styleUrls: ['./virtual-keyboard.component.scss'],
  standalone: false,
})
export class VirtualKeyboardComponent {
  protected readonly keyboard = inject(VirtualKeyboardService);
  protected readonly lang = inject(LanguageService);

  protected readonly digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  protected readonly symbols = ['@', '.', '-', '_', '/'];

  protected readonly shiftKey: VirtualKeyboardKey = { label: '⇧', action: 'shift' };
  protected readonly backspaceKey: VirtualKeyboardKey = { label: '⌫', action: 'backspace' };
  protected readonly spaceKey: VirtualKeyboardKey = { label: ' ', action: 'space' };
  protected readonly doneKey: VirtualKeyboardKey = { label: '✓', action: 'done' };

  @HostListener('document:focusin', ['$event'])
  protected onFocusIn(event: FocusEvent): void {
    this.keyboard.handleFocus(event.target);
  }

  @HostListener('document:focusout', ['$event'])
  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as HTMLElement | null;
    if (next?.closest('[data-virtual-keyboard-root]')) {
      // Focus stayed inside the keyboard; keep it open for the same field.
      return;
    }

    // Focus moves asynchronously, so re-check once it has settled.
    window.setTimeout(() => this.closeIfFocusLeft());
  }

  /** Prevents the focused field from losing focus (and its caret) on key press. */
  protected retainFocus(event: MouseEvent): void {
    event.preventDefault();
  }

  protected type(value: string): void {
    this.keyboard.typeCharacter(value);
  }

  private closeIfFocusLeft(): void {
    const active = document.activeElement as HTMLElement | null;
    if (this.keyboard.accepts(active) || active?.closest('[data-virtual-keyboard-root]')) {
      return;
    }
    this.keyboard.close();
  }
}
