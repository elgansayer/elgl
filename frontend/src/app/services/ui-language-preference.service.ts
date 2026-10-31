import { DOCUMENT } from '@angular/common';
import { inject, Injectable, WritableSignal } from '@angular/core';
import { I18nService, LanguageInfo } from './i18n.service';
import { LoggingService } from './logging.service';

const LOCALE_STORAGE_KEY = 'hellotalk_locale';
const DICTIONARY_STORAGE_PREFIX = 'hellotalk_dict_';
const MAX_DICTIONARY_ENTRIES = 5_000;
const MAX_TRANSLATION_KEY_LENGTH = 200;
const MAX_TRANSLATION_VALUE_LENGTH = 10_000;
const LOG_CONTEXT = 'UiLanguagePreferenceService';
const LOCALE_LOG_PATTERN = /^[A-Za-z0-9-]{1,35}$/;

/**
 * Why a change was refused. Callers use it to choose feedback; it never carries
 * provider output, dictionaries or user content.
 */
export type UiLanguageFailureReason = 'unsupported' | 'busy' | 'translation-unavailable';

interface LanguageSnapshot {
  language: string;
  translations: Record<string, string>;
}

interface PendingChange {
  code: string;
  promise: Promise<void>;
}

export class UiLanguagePreferenceError extends Error {
  constructor(readonly reason: UiLanguageFailureReason = 'translation-unavailable') {
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
 *
 * Every interface-language picker must go through this service. A repository
 * contract test rejects direct I18nService.setLanguage calls from UI code.
 */
@Injectable({ providedIn: 'root' })
export class UiLanguagePreferenceService {
  private readonly i18n = inject(I18nService);
  private readonly document = inject(DOCUMENT);
  private readonly logging = inject(LoggingService);

  readonly currentLang: WritableSignal<string> = this.i18n.currentLang;
  readonly availableLanguages: readonly LanguageInfo[] = this.i18n.availableLanguages;

  private pending: PendingChange | null = null;

  /**
   * Switches the interface language, or rejects with UiLanguagePreferenceError
   * after restoring the previous locale, dictionary and document attributes.
   *
   * Changes are single-flight: a repeat request for the locale already being
   * loaded shares that attempt, and a request for a different locale is refused
   * as busy so two pickers can never interleave snapshots and rollbacks.
   */
  async changeLanguage(rawCode: string): Promise<void> {
    const code = rawCode.trim();
    if (!this.isSupported(code)) {
      throw this.refuse(code, 'unsupported');
    }

    if (this.pending) {
      if (this.pending.code === code) {
        return this.pending.promise;
      }
      throw this.refuse(code, 'busy');
    }

    if (code === this.currentLang()) {
      return;
    }

    const attempt = this.applyChange(code);
    this.pending = { code, promise: attempt };
    try {
      await attempt;
    } finally {
      this.pending = null;
    }
  }

  private async applyChange(code: string): Promise<void> {
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
      throw this.refuse(code, 'translation-unavailable');
    }
  }

  private refuse(code: string, reason: UiLanguageFailureReason): UiLanguagePreferenceError {
    // Only the locale code and a failure category are logged: never dictionaries,
    // provider responses, tokens or user-authored content.
    this.logging.warn('Interface language change refused', LOG_CONTEXT, {
      locale: LOCALE_LOG_PATTERN.test(code) ? code : 'invalid',
      reason,
    });
    return new UiLanguagePreferenceError(reason);
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
