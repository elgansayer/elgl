import { DOCUMENT } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from './i18n.service';
import { LoggingService } from './logging.service';
import {
  UiLanguagePreferenceError,
  UiLanguagePreferenceService,
} from './ui-language-preference.service';

describe('UiLanguagePreferenceService', () => {
  const english = { 'settings.title': 'Settings', 'common.save': 'Save' };
  const spanish = { 'settings.title': 'Ajustes', 'common.save': 'Guardar' };

  let currentLang = signal('en-GB');
  let translations = signal<Record<string, string>>(english);
  let setLanguage: ReturnType<typeof vi.fn>;
  let warn: ReturnType<typeof vi.fn>;
  let service: UiLanguagePreferenceService;
  let documentRef: Document;

  beforeEach(() => {
    currentLang = signal('en-GB');
    translations = signal<Record<string, string>>(english);
    setLanguage = vi.fn();
    warn = vi.fn();
    documentRef = document;
    documentRef.documentElement.lang = 'en-GB';
    documentRef.documentElement.dir = 'ltr';
    window.localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        UiLanguagePreferenceService,
        {
          provide: I18nService,
          useValue: {
            currentLang,
            translations,
            availableLanguages: [
              {
                code: 'en-GB',
                name: 'British English',
                nativeName: 'English (UK)',
                flag: '🇬🇧',
                isRtl: false,
              },
              {
                code: 'es',
                name: 'Spanish',
                nativeName: 'Español',
                flag: '🇪🇸',
                isRtl: false,
              },
              {
                code: 'ar',
                name: 'Arabic',
                nativeName: 'العربية',
                flag: '🇸🇦',
                isRtl: true,
              },
            ],
            setLanguage,
          },
        },
        { provide: DOCUMENT, useValue: documentRef },
        { provide: LoggingService, useValue: { warn } },
      ],
    });

    service = TestBed.inject(UiLanguagePreferenceService);
  });

  it('commits a supported UI language only after its dictionary is available', async () => {
    setLanguage.mockImplementation(async (code: string) => {
      currentLang.set(code);
      translations.set(spanish);
      window.localStorage.setItem('hellotalk_locale', code);
    });

    await service.changeLanguage('es');

    expect(setLanguage).toHaveBeenCalledWith('es');
    expect(service.currentLang()).toBe('es');
    expect(translations()).toBe(spanish);
  });

  it('rolls back the locale when the legacy loader silently fails to load translations', async () => {
    const originalDictionary = translations();
    setLanguage.mockImplementation(async (code: string) => {
      currentLang.set(code);
      window.localStorage.setItem('hellotalk_locale', code);
      // Mirrors the legacy no-token/provider-failure path: currentLang changes,
      // but the active dictionary is left untouched.
    });

    await expect(service.changeLanguage('es')).rejects.toBeInstanceOf(UiLanguagePreferenceError);

    expect(currentLang()).toBe('en-GB');
    expect(translations()).toBe(originalDictionary);
    expect(window.localStorage.getItem('hellotalk_locale')).toBe('en-GB');
    expect(documentRef.documentElement.lang).toBe('en-GB');
    expect(documentRef.documentElement.dir).toBe('ltr');
  });

  it('restores the previous RTL document state after a failed switch', async () => {
    currentLang.set('ar');
    translations.set({ 'settings.title': 'الإعدادات' });
    documentRef.documentElement.lang = 'ar';
    documentRef.documentElement.dir = 'rtl';
    setLanguage.mockRejectedValue(new Error('provider unavailable'));

    await expect(service.changeLanguage('es')).rejects.toBeInstanceOf(UiLanguagePreferenceError);

    expect(currentLang()).toBe('ar');
    expect(documentRef.documentElement.lang).toBe('ar');
    expect(documentRef.documentElement.dir).toBe('rtl');
  });

  it('rejects unsupported locale values before touching the translation loader', async () => {
    await expect(service.changeLanguage('not-supported')).rejects.toBeInstanceOf(
      UiLanguagePreferenceError,
    );

    expect(setLanguage).not.toHaveBeenCalled();
    expect(currentLang()).toBe('en-GB');
  });

  it('does not reload the already active interface language', async () => {
    await service.changeLanguage('en-GB');

    expect(setLanguage).not.toHaveBeenCalled();
  });

  it('removes a malformed cached dictionary before loading the selected locale', async () => {
    window.localStorage.setItem('hellotalk_dict_es', JSON.stringify({ broken: 42 }));
    setLanguage.mockImplementation(async (code: string) => {
      expect(window.localStorage.getItem('hellotalk_dict_es')).toBeNull();
      currentLang.set(code);
      translations.set(spanish);
    });

    await service.changeLanguage('es');

    expect(currentLang()).toBe('es');
  });

  it('accepts English without requiring a remotely translated dictionary', async () => {
    currentLang.set('es');
    translations.set(spanish);
    setLanguage.mockImplementation(async (code: string) => {
      currentLang.set(code);
      translations.set({ ...english });
    });

    await service.changeLanguage('en-GB');

    expect(currentLang()).toBe('en-GB');
    expect(translations()).toEqual(english);
  });

  describe('failure reasons', () => {
    it('reports unsupported locales with a typed reason', async () => {
      await expect(service.changeLanguage('not-supported')).rejects.toMatchObject({
        reason: 'unsupported',
      });
    });

    it('reports a failed dictionary load as translation-unavailable', async () => {
      setLanguage.mockImplementation(async (code: string) => {
        currentLang.set(code);
      });

      await expect(service.changeLanguage('es')).rejects.toMatchObject({
        reason: 'translation-unavailable',
      });
    });

    it('rolls back when the provider throws and never leaks the provider message', async () => {
      setLanguage.mockRejectedValue(new Error('DeepL key sk-secret rejected'));

      const failure = await service.changeLanguage('es').then(
        () => null,
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(UiLanguagePreferenceError);
      expect(failure).toHaveProperty('message', 'Unable to change interface language');
      expect(currentLang()).toBe('en-GB');
    });
  });

  describe('concurrent changes', () => {
    let finishLoad: () => void;

    beforeEach(() => {
      setLanguage.mockImplementation(
        (code: string) =>
          new Promise<void>((resolve) => {
            finishLoad = () => {
              currentLang.set(code);
              translations.set(spanish);
              resolve();
            };
          }),
      );
    });

    it('shares the in-flight attempt when the same locale is requested twice', async () => {
      const first = service.changeLanguage('es');
      const second = service.changeLanguage('es');

      finishLoad();
      await Promise.all([first, second]);

      expect(setLanguage).toHaveBeenCalledTimes(1);
      expect(currentLang()).toBe('es');
    });

    it('refuses a different locale while another change is loading', async () => {
      const first = service.changeLanguage('es');

      await expect(service.changeLanguage('ar')).rejects.toMatchObject({ reason: 'busy' });
      expect(setLanguage).toHaveBeenCalledTimes(1);

      finishLoad();
      await first;
      expect(currentLang()).toBe('es');
    });

    it('accepts a new change once the previous attempt has succeeded', async () => {
      const first = service.changeLanguage('es');
      finishLoad();
      await first;

      setLanguage.mockImplementation(async (code: string) => {
        currentLang.set(code);
        translations.set({ 'settings.title': 'الإعدادات' });
      });
      await service.changeLanguage('ar');

      expect(currentLang()).toBe('ar');
    });

    it('accepts a new change once the previous attempt has failed', async () => {
      setLanguage.mockRejectedValueOnce(new Error('provider unavailable'));
      await expect(service.changeLanguage('es')).rejects.toBeInstanceOf(UiLanguagePreferenceError);

      setLanguage.mockImplementation(async (code: string) => {
        currentLang.set(code);
        translations.set(spanish);
      });
      await service.changeLanguage('es');

      expect(currentLang()).toBe('es');
    });
  });

  describe('observability', () => {
    it('logs only the locale and a failure category when a switch is rolled back', async () => {
      translations.set(english);
      setLanguage.mockRejectedValue(new Error('Bearer eyJhbGciOi.secret.token failed'));

      await expect(service.changeLanguage('es')).rejects.toBeInstanceOf(UiLanguagePreferenceError);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        'Interface language change refused',
        'UiLanguagePreferenceService',
        { locale: 'es', reason: 'translation-unavailable' },
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain('Bearer');
      expect(JSON.stringify(warn.mock.calls)).not.toContain('Ajustes');
    });

    it('does not echo arbitrary unsupported input into the log', async () => {
      await expect(service.changeLanguage('<script>alert(1)</script>')).rejects.toMatchObject({
        reason: 'unsupported',
      });

      expect(warn).toHaveBeenCalledWith(
        'Interface language change refused',
        'UiLanguagePreferenceService',
        { locale: 'invalid', reason: 'unsupported' },
      );
    });

    it('does not log a successful change or a no-op', async () => {
      await service.changeLanguage('en-GB');

      expect(warn).not.toHaveBeenCalled();
    });
  });
});
