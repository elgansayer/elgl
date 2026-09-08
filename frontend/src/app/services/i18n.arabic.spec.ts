import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { I18nService } from './i18n.service';

describe('I18nService Arabic rendering contract', () => {
  let service: I18nService;
  let testDocument: Document;

  beforeEach(() => {
    localStorage.clear();
    testDocument = document.implementation.createHTMLDocument();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DOCUMENT, useValue: testDocument },
        {
          provide: AuthService,
          useValue: { getAccessToken: vi.fn().mockResolvedValue('test-token') },
        },
      ],
    });
    service = TestBed.inject(I18nService);
  });

  afterEach(() => {
    testDocument.documentElement.lang = 'en-GB';
    testDocument.documentElement.dir = 'ltr';
    testDocument.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  it.each([
    ['light', false],
    ['dark', true],
  ])('keeps Arabic language and RTL semantics intact in %s mode', async (_mode, darkMode) => {
    localStorage.setItem('hellotalk_dict_ar', JSON.stringify({}));

    testDocument.documentElement.classList.toggle('dark', darkMode);
    const languageChange = service.setLanguage('ar');
    expect(testDocument.documentElement.classList.contains('dark')).toBe(darkMode);
    await languageChange;

    expect(service.currentLang()).toBe('ar');
    expect(service.direction()).toBe('rtl');
    expect(testDocument.documentElement.lang).toBe('ar');
    expect(testDocument.documentElement.dir).toBe('rtl');
    const arabic = service.availableLanguages.find((language) => language.code === 'ar');
    expect(arabic).toMatchObject({ nativeName: 'العربية', isRtl: true });
  });

  it('restores LTR document semantics when the UI leaves an Arabic locale', async () => {
    localStorage.setItem('hellotalk_dict_ar', JSON.stringify({}));
    localStorage.setItem('hellotalk_dict_en-GB', JSON.stringify({}));

    await service.setLanguage('ar');
    expect(testDocument.documentElement.dir).toBe('rtl');

    await service.setLanguage('en-GB');

    expect(service.currentLang()).toBe('en-GB');
    expect(service.direction()).toBe('ltr');
    expect(testDocument.documentElement.lang).toBe('en-GB');
    expect(testDocument.documentElement.dir).toBe('ltr');
  });
});
