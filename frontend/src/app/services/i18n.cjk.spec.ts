import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { I18nService } from './i18n.service';

describe('I18nService CJK rendering contract', () => {
  let service: I18nService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { getAccessToken: vi.fn().mockReturnValue('test-token') },
        },
      ],
    });
    service = TestBed.inject(I18nService);
  });

  afterEach(() => {
    document.documentElement.lang = 'en-GB';
    document.documentElement.dir = 'ltr';
    localStorage.clear();
  });

  it.each([
    ['ja', 'Japanese'],
    ['zh', 'Mandarin Chinese'],
    ['ko', 'Korean'],
  ])('keeps %s (%s) language identity and horizontal LTR direction in sync with the document', async (code) => {
    localStorage.setItem(`hellotalk_dict_${code}`, JSON.stringify({}));

    await service.setLanguage(code);

    expect(service.currentLang()).toBe(code);
    expect(document.documentElement.lang).toBe(code);
    expect(document.documentElement.dir).toBe('ltr');
    expect(service.direction()).toBe('ltr');
  });

  it('publishes Japanese, Chinese, and Korean as non-RTL application languages', () => {
    for (const code of ['ja', 'zh', 'ko']) {
      const language = service.availableLanguages.find((candidate) => candidate.code === code);
      expect(language, `missing ${code} language metadata`).toBeTruthy();
      expect(language?.isRtl).toBe(false);
    }
  });
});
