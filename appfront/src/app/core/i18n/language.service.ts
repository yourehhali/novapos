import { Injectable, computed, signal } from '@angular/core';
import { AppLanguage, TRANSLATIONS, TranslationParams } from './translations';

const STORAGE_KEY = 'RoxPos.language';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly current = signal<AppLanguage>(this.readStoredLanguage());

  readonly language = this.current.asReadonly();
  readonly isFrench = computed(() => this.current() === 'fr');

  setLanguage(language: AppLanguage): void {
    this.current.set(language);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, language);
    }
  }

  toggle(): void {
    this.setLanguage(this.current() === 'fr' ? 'de' : 'fr');
  }

  t(key: string, params?: TranslationParams): string {
    const active = TRANSLATIONS[this.current()];
    const template = active[key] ?? TRANSLATIONS.fr[key] ?? key;
    return params ? this.interpolate(template, params) : template;
  }

  private interpolate(template: string, params: TranslationParams): string {
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      params[name] === undefined ? match : String(params[name]),
    );
  }

  private readStoredLanguage(): AppLanguage {
    if (typeof window === 'undefined') {
      return 'fr';
    }

    return window.localStorage.getItem(STORAGE_KEY) === 'de' ? 'de' : 'fr';
  }
}
