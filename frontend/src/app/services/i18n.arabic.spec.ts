import { Directionality } from '@angular/cdk/bidi';
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

  it('keeps the CDK Directionality service in step with runtime language changes', async () => {
    localStorage.setItem('hellotalk_dict_ar', JSON.stringify({}));
    localStorage.setItem('hellotalk_dict_ur', JSON.stringify({}));
    localStorage.setItem('hellotalk_dict_en-GB', JSON.stringify({}));
    const directionality = TestBed.inject(Directionality);
    const emitted = vi.spyOn(directionality.change, 'emit');
    expect(directionality.value).toBe('ltr');

    await service.setLanguage('ar');
    expect(directionality.value).toBe('rtl');
    expect(directionality.valueSignal()).toBe('rtl');
    expect(emitted).toHaveBeenCalledTimes(1);
    expect(emitted).toHaveBeenLastCalledWith('rtl');

    // Moving between two RTL languages is not a direction change.
    await service.setLanguage('ur');
    expect(directionality.value).toBe('rtl');
    expect(emitted).toHaveBeenCalledTimes(1);

    await service.setLanguage('en-GB');
    expect(directionality.value).toBe('ltr');
    expect(emitted).toHaveBeenCalledTimes(2);
    expect(emitted).toHaveBeenLastCalledWith('ltr');
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
