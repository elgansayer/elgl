import { DOCUMENT } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from './i18n.service';
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
  let service: UiLanguagePreferenceService;
  let documentRef: Document;

  beforeEach(() => {
    currentLang = signal('en-GB');
    translations = signal<Record<string, string>>(english);
    setLanguage = vi.fn();
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
});
