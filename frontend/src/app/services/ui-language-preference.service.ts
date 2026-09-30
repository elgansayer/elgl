import { DOCUMENT } from '@angular/common';
import { inject, Injectable, WritableSignal } from '@angular/core';
import { I18nService, LanguageInfo } from './i18n.service';

const LOCALE_STORAGE_KEY = 'hellotalk_locale';
const DICTIONARY_STORAGE_PREFIX = 'hellotalk_dict_';
const MAX_DICTIONARY_ENTRIES = 5_000;
const MAX_TRANSLATION_KEY_LENGTH = 200;
const MAX_TRANSLATION_VALUE_LENGTH = 10_000;

interface LanguageSnapshot {
  language: string;
  translations: Record<string, string>;
}

export class UiLanguagePreferenceError extends Error {
  constructor() {
    super('Unable to change interface language');
    this.name = 'UiLanguagePreferenceError';
  }
}

/**
 * Transaction boundary for user-triggered interface-language changes.
 *
 * I18nService supports best-effort dynamic translation for several legacy call
 * sites. Settings needs a stronger contract: a requested locale is only kept
 * when a usable dictionary was actually loaded. This adapter provides that
 * fail-closed behaviour without coupling the UI-language choice to study
 * languages or profile matching preferences.
 */
@Injectable({ providedIn: 'root' })
export class UiLanguagePreferenceService {
  private readonly i18n = inject(I18nService);
  private readonly document = inject(DOCUMENT);

  readonly currentLang: WritableSignal<string> = this.i18n.currentLang;
  readonly availableLanguages: readonly LanguageInfo[] = this.i18n.availableLanguages;

  async changeLanguage(rawCode: string): Promise<void> {
    const code = rawCode.trim();
    if (!this.isSupported(code)) {
      throw new UiLanguagePreferenceError();
    }

    if (code === this.currentLang()) {
      return;
    }

    const snapshot: LanguageSnapshot = {
      language: this.currentLang(),
      translations: this.i18n.translations(),
    };

    this.removeInvalidCachedDictionary(code);

    try {
      await this.i18n.setLanguage(code);
      if (!this.hasUsableCommittedLanguage(code, snapshot)) {
        throw new UiLanguagePreferenceError();
      }
    } catch {
      this.restoreSnapshot(snapshot);
      throw new UiLanguagePreferenceError();
    }
  }

  private isSupported(code: string): boolean {
    return this.availableLanguages.some((language) => language.code === code);
  }

  private hasUsableCommittedLanguage(code: string, snapshot: LanguageSnapshot): boolean {
    if (this.currentLang() !== code) {
      return false;
    }

    const dictionary = this.i18n.translations();
    if (!this.isDictionary(dictionary)) {
      return false;
    }

    if (this.isEnglish(code)) {
      return true;
    }

    // Legacy I18nService deliberately swallows provider/auth/network failures.
    // On those paths it changes currentLang but leaves the dictionary reference
    // untouched. Treat that split-brain state as a failed locale switch.
    return dictionary !== snapshot.translations;
  }

  private isEnglish(code: string): boolean {
    return code === 'en' || code === 'en-GB' || code === 'en-US';
  }

  private isDictionary(value: unknown): value is Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const entries = Object.entries(value);
    if (entries.length === 0 || entries.length > MAX_DICTIONARY_ENTRIES) {
      return false;
    }

    return entries.every(
      ([key, translation]) =>
        key.length > 0 &&
        key.length <= MAX_TRANSLATION_KEY_LENGTH &&
        typeof translation === 'string' &&
        translation.length <= MAX_TRANSLATION_VALUE_LENGTH,
    );
  }

  private removeInvalidCachedDictionary(code: string): void {
    const storage = this.getStorage();
    if (!storage) return;

    const key = `${DICTIONARY_STORAGE_PREFIX}${code}`;
    try {
      const cached = storage.getItem(key);
      if (!cached) return;

      const parsed: unknown = JSON.parse(cached);
      if (!this.isDictionary(parsed)) {
        storage.removeItem(key);
      }
    } catch {
      try {
        storage.removeItem(key);
      } catch {
        // Browser privacy/quota settings can make storage unavailable.
      }
    }
  }

  private restoreSnapshot(snapshot: LanguageSnapshot): void {
    this.i18n.currentLang.set(snapshot.language);
    this.i18n.translations.set(snapshot.translations);

    const language = this.availableLanguages.find((item) => item.code === snapshot.language);
    const root = this.document.documentElement;
    if (root) {
      root.lang = snapshot.language;
      root.dir = language?.isRtl ? 'rtl' : 'ltr';
    }

    const storage = this.getStorage();
    if (!storage) return;

    try {
      storage.setItem(LOCALE_STORAGE_KEY, snapshot.language);
    } catch {
      // Runtime language state remains valid even when persistence is blocked.
    }
  }

  private getStorage(): Storage | null {
    try {
      return this.document.defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  }
}
