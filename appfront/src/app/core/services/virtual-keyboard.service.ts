import { Injectable, computed, inject, signal } from '@angular/core';
import { LanguageService } from '../i18n/language.service';

/** Which on-screen pad to show for the focused field. */
export type VirtualKeyboardKind = 'text' | 'integer' | 'decimal';

export type VirtualKeyboardAction = 'char' | 'backspace' | 'clear' | 'shift' | 'space' | 'done';

export interface VirtualKeyboardKey {
  label: string;
  action: VirtualKeyboardAction;
  value?: string;
  /** Relative width inside a row (1 = one key, 2 = twice as wide). */
  grow?: number;
  tone?: 'accent' | 'ghost';
}

type EditableElement = HTMLInputElement | HTMLTextAreaElement;

/** Inputs that are not typed with a character keyboard (pickers, toggles...). */
const IGNORED_INPUT_TYPES = new Set([
  'range',
  'checkbox',
  'radio',
  'file',
  'color',
  'date',
  'datetime-local',
  'time',
  'month',
  'week',
  'submit',
  'button',
  'reset',
  'image',
  'hidden',
]);

/** Add `data-virtual-keyboard="off"` on an input to keep the native keyboard. */
const OPT_OUT_SELECTOR = '[data-virtual-keyboard="off"]';

/** Approximate keyboard height, used to keep the focused field visible. */
const KEYBOARD_HEIGHT = 240;

/** Letter rows per language: AZERTY for French, QWERTZ for German, QWERTY otherwise. */
const TEXT_ROWS: Record<string, string[][]> = {
  fr: [
    ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'],
    ['w', 'x', 'c', 'v', 'b', 'n', "'"],
  ],
  de: [
    ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'ü'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä'],
    ['y', 'x', 'c', 'v', 'b', 'n', 'm', 'ß'],
  ],
  default: [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
  ],
};

/**
 * Drives the in-app on-screen keyboard: it follows focus between fields, picks the
 * matching pad (letters or numbers) and writes the pressed keys back into the field.
 */
@Injectable({ providedIn: 'root' })
export class VirtualKeyboardService {
  private readonly lang = inject(LanguageService);

  private readonly target = signal<EditableElement | null>(null);
  private readonly kind = signal<VirtualKeyboardKind>('text');
  private readonly caps = signal(false);
  /** Mirror of the value being typed for `type="number"` fields (see writeDraft). */
  private readonly draft = signal<string | null>(null);

  readonly visible = computed(() => this.target() !== null);
  readonly inputKind = this.kind.asReadonly();
  readonly capsLock = this.caps.asReadonly();

  readonly textRows = computed(() => TEXT_ROWS[this.lang.language()] ?? TEXT_ROWS['default']);

  readonly numericRows = computed<VirtualKeyboardKey[][]>(() => {
    const rows: VirtualKeyboardKey[][] = [
      [charKey('7'), charKey('8'), charKey('9'), { label: '⌫', action: 'backspace', tone: 'ghost' }],
      [charKey('4'), charKey('5'), charKey('6'), { label: 'C', action: 'clear', tone: 'ghost' }],
      [charKey('1'), charKey('2'), charKey('3'), { label: '✓', action: 'done', tone: 'accent' }],
    ];

    rows.push(
      this.kind() === 'decimal'
        ? [charKey('.'), { ...charKey('0'), grow: 2 }, charKey('-')]
        : [{ ...charKey('0'), grow: 4 }],
    );

    return rows;
  });

  /** Opens the keyboard for the focused element, if it accepts one. */
  handleFocus(target: EventTarget | null): void {
    const element = this.asEditable(target);
    if (!element) {
      return;
    }

    this.caps.set(false);
    this.draft.set(isNumberInput(element) ? element.value : null);
    this.kind.set(resolveKind(element));
    this.target.set(element);
    this.revealElement(element);
  }

  /** True when the element is one the keyboard can type into. */
  accepts(target: EventTarget | null): boolean {
    return this.asEditable(target) !== null;
  }

  close(): void {
    this.target.set(null);
    this.draft.set(null);
    this.caps.set(false);
  }

  press(key: VirtualKeyboardKey): void {
    const element = this.target();
    if (!element) {
      return;
    }

    switch (key.action) {
      case 'shift':
        this.caps.update((value) => !value);
        return;
      case 'backspace':
        this.deleteBackward(element);
        return;
      case 'clear':
        this.clearAll(element);
        return;
      case 'done':
        this.finish(element);
        return;
      case 'space':
        this.writeText(element, ' ');
        return;
      default:
        this.writeText(element, key.value ?? key.label);
    }
  }

  /** Convenience entry point for template-driven keys (letters, digits, symbols). */
  typeCharacter(value: string): void {
    const element = this.target();
    if (element) {
      this.writeText(element, value);
    }
  }

  private writeText(element: EditableElement, value: string): void {
    if (!value) {
      return;
    }

    let resolved = value;
    if (isLetter(value) && this.caps()) {
      resolved = value.toUpperCase();
      // Shift applies to a single letter, like a phone keyboard.
      this.caps.set(false);
    }

    if (this.kind() === 'text') {
      this.insertAtCaret(element, resolved);
      return;
    }

    this.insertNumeric(element, resolved);
  }

  /** Applies a numeric key: digits always, `.`/`-` only for decimal fields. */
  private insertNumeric(element: EditableElement, value: string): void {
    if (!/^[0-9]$/.test(value)) {
      if (this.kind() !== 'decimal' || !/^[.-]$/.test(value)) {
        return;
      }
    }

    const draft = this.draft();
    const current = draft ?? element.value;

    if (value === '.' && current.includes('.')) {
      return;
    }
    if (value === '-' && current.length > 0) {
      return;
    }

    if (draft === null) {
      this.insertAtCaret(element, value);
      return;
    }

    this.writeDraft(element, current + value);
  }

  /**
   * Number inputs silently drop intermediate values such as "12." or "-", so the
   * element keeps its last valid number while the draft tracks what was typed.
   */
  private writeDraft(element: EditableElement, next: string): void {
    const previous = element.value;
    const maxLength = element.maxLength;
    if (maxLength >= 0 && next.length > maxLength) {
      return;
    }

    this.draft.set(next);
    element.value = next;
    if (element.value !== next) {
      element.value = previous;
    }
    this.emitInput(element);
  }

  private deleteBackward(element: EditableElement): void {
    const draft = this.draft();
    if (draft !== null) {
      if (!draft) {
        return;
      }
      this.writeDraft(element, draft.slice(0, -1));
      return;
    }

    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    if (start === end && start === 0) {
      return;
    }

    const next =
      end > start
        ? element.value.slice(0, start) + element.value.slice(end)
        : element.value.slice(0, start - 1) + element.value.slice(start);

    element.value = next;
    this.setCaret(element, end > start ? start : start - 1);
    this.emitInput(element);
  }

  private clearAll(element: EditableElement): void {
    if (this.draft() !== null) {
      this.draft.set('');
    }
    element.value = '';
    this.setCaret(element, 0);
    this.emitInput(element);
  }

  private finish(element: EditableElement): void {
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.blur();
  }

  private insertAtCaret(element: EditableElement, value: string): void {
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    const next = element.value.slice(0, start) + value + element.value.slice(end);

    const maxLength = element.maxLength;
    if (maxLength >= 0 && next.length > maxLength) {
      return;
    }

    element.value = next;
    this.setCaret(element, start + value.length);
    this.emitInput(element);
  }

  private setCaret(element: EditableElement, position: number): void {
    try {
      element.setSelectionRange(position, position);
    } catch {
      // Number inputs do not support selection ranges.
    }
  }

  /** Notifies Angular (ngModel) that the field value changed. */
  private emitInput(element: EditableElement): void {
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private revealElement(element: EditableElement): void {
    window.requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect();
      const hiddenBelow = rect.bottom - (window.innerHeight - KEYBOARD_HEIGHT);
      if (hiddenBelow > 0) {
        window.scrollBy({ top: hiddenBelow + 16 });
      }
    });
  }

  private asEditable(target: EventTarget | null): EditableElement | null {
    if (!(target instanceof HTMLElement)) {
      return null;
    }

    const tag = target.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
      return null;
    }
    if (target.closest(OPT_OUT_SELECTOR)) {
      return null;
    }

    const input = target as HTMLInputElement;
    if (input.disabled || input.readOnly) {
      return null;
    }
    if (tag === 'INPUT' && IGNORED_INPUT_TYPES.has((input.type || 'text').toLowerCase())) {
      return null;
    }

    return target as EditableElement;
  }
}

function charKey(value: string): VirtualKeyboardKey {
  return { label: value, action: 'char', value };
}

function isNumberInput(element: EditableElement): boolean {
  return element.tagName === 'INPUT' && (element as HTMLInputElement).type === 'number';
}

function isLetter(value: string): boolean {
  return value.length === 1 && /\p{L}/u.test(value);
}

function resolveKind(element: EditableElement): VirtualKeyboardKind {
  const inputMode = (element.getAttribute('inputmode') ?? '').toLowerCase();
  if (inputMode === 'numeric') {
    return 'integer';
  }
  if (inputMode === 'decimal') {
    return 'decimal';
  }
  if (element.tagName === 'TEXTAREA') {
    return 'text';
  }

  const type = (element as HTMLInputElement).type;
  if (type === 'number') {
    return 'decimal';
  }
  if (type === 'tel' || inputMode === 'tel') {
    return 'integer';
  }
  return 'text';
}
