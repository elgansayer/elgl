import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { I18nService, UI_TRANSLATION_BATCH_SIZE } from './i18n.service';
import { resolveTextDirection } from './text-direction';

interface TranslateUiRequest {
  target_language: string;
  dictionary: Record<string, string>;
}

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: () => Promise.resolve(body) } as Response;
}

function requestOf(call: unknown[]): TranslateUiRequest {
  const init = call[1] as RequestInit;
  return JSON.parse(String(init.body)) as TranslateUiRequest;
}

/** Answers a batch request by prefixing every value with the language. */
function echoTranslations(prefix: string): (input: unknown, init?: RequestInit) => Promise<Response> {
  return (_input, init) => {
    const request = JSON.parse(String(init?.body)) as TranslateUiRequest;
    return Promise.resolve(
      jsonResponse({
        translations: Object.fromEntries(
          Object.entries(request.dictionary).map(([key, value]) => [key, `${prefix}${value}`]),
        ),
      }),
    );
  };
}

describe('I18nService interface translation', () => {
  let service: I18nService;
  let testDocument: Document;
  let token: string | undefined;

  beforeEach(() => {
    localStorage.clear();
    token = 'test-token';
    testDocument = document.implementation.createHTMLDocument();
    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: testDocument },
        { provide: AuthService, useValue: { getAccessToken: () => token } },
      ],
    });
    service = TestBed.inject(I18nService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('interface mirroring', () => {
    it.each(['ar', 'ar-EG', 'ar-SA', 'he-IL', 'fa-IR', 'ur-PK', 'ps', 'az-Arab'])(
      'mirrors the document and the direction signal for %s',
      async (locale) => {
        localStorage.setItem(`hellotalk_dict_${locale}`, JSON.stringify({}));

        await service.setLanguage(locale);

        expect(service.direction()).toBe('rtl');
        expect(testDocument.documentElement.dir).toBe('rtl');
        expect(testDocument.documentElement.lang).toBe(locale);
      },
    );

    it('returns to left to right when the user leaves a right-to-left language', async () => {
      localStorage.setItem('hellotalk_dict_ar-EG', JSON.stringify({}));
      await service.setLanguage('ar-EG');
      await service.setLanguage('en-GB');

      expect(service.direction()).toBe('ltr');
      expect(testDocument.documentElement.dir).toBe('ltr');
      expect(testDocument.documentElement.lang).toBe('en-GB');
    });

    it('keeps the declared RTL flag of every selectable language in line with the direction rules', () => {
      for (const language of service.availableLanguages) {
        expect(resolveTextDirection(language.code) === 'rtl', language.code).toBe(language.isRtl);
      }
    });
  });

  describe('batched requests', () => {
    it('sends the whole English dictionary exactly once in bounded batches', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(echoTranslations('[sw] '));
      const english = service.translations();

      await service.setLanguage('sw');

      const requests = fetchSpy.mock.calls.map(requestOf);
      expect(requests.length).toBeGreaterThan(1);
      for (const request of requests) {
        expect(request.target_language).toBe('sw');
        const size = Object.keys(request.dictionary).length;
        expect(size).toBeGreaterThan(0);
        expect(size).toBeLessThanOrEqual(UI_TRANSLATION_BATCH_SIZE);
      }
      const sentKeys = requests.flatMap((request) => Object.keys(request.dictionary));
      expect(sentKeys).toHaveLength(Object.keys(english).length);
      expect(new Set(sentKeys).size).toBe(sentKeys.length);
      expect(Object.assign({}, ...requests.map((request) => request.dictionary))).toEqual(english);
    });

    it('authenticates every batch with the access token', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(echoTranslations(''));

      await service.setLanguage('sw');

      for (const [, init] of fetchSpy.mock.calls) {
        const headers = (init as RequestInit).headers as Record<string, string>;
        expect(headers['Authorization']).toBe('Bearer test-token');
        expect(headers['Content-Type']).toBe('application/json');
      }
    });

    it('applies the merged translations and caches the complete dictionary', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(echoTranslations('[sw] '));

      await service.setLanguage('sw');

      expect(service.translate('app.title')).toBe('[sw] HelloTalk');
      expect(service.translate('common.coinsBalance', { coins: 3 })).toBe('[sw] 3 Coins');
      const cached = JSON.parse(localStorage.getItem('hellotalk_dict_sw') ?? '{}') as Record<
        string,
        string
      >;
      expect(Object.keys(cached)).toHaveLength(Object.keys(service.translations()).length);
      expect(cached['app.title']).toBe('[sw] HelloTalk');
    });

    it('does not request translations again once a dictionary is cached', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(echoTranslations('[sw] '));
      await service.setLanguage('sw');
      fetchSpy.mockClear();

      await service.setLanguage('en-GB');
      await service.setLanguage('sw');

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(service.translate('app.title')).toBe('[sw] HelloTalk');
    });

    it('does not call the API without an access token', async () => {
      token = undefined;
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const before = service.translations();

      await service.setLanguage('sw');

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(service.translations()).toBe(before);
      expect(service.currentLang()).toBe('sw');
    });
  });

  describe('failure handling', () => {
    it('keeps the current dictionary and caches nothing when a later batch fails', async () => {
      let calls = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        calls += 1;
        return calls === 2 ? Promise.resolve(jsonResponse({}, false)) : echoTranslations('[sw] ')(input, init);
      });
      const before = service.translations();

      await service.setLanguage('sw');

      expect(calls).toBe(2);
      expect(service.translations()).toBe(before);
      expect(localStorage.getItem('hellotalk_dict_sw')).toBeNull();
      expect(service.translate('app.title')).toBe('HelloTalk');
    });

    it('keeps the current dictionary when the network fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
      const before = service.translations();

      await service.setLanguage('sw');

      expect(service.translations()).toBe(before);
      expect(localStorage.getItem('hellotalk_dict_sw')).toBeNull();
    });

    it.each([
      ['a missing translations property', { other: {} }],
      ['a null body', null],
      ['an array of translations', { translations: ['Hello'] }],
      ['a string of translations', { translations: 'Hello' }],
    ])('ignores a response with %s', async (_label, body) => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(body));
      const before = service.translations();

      await service.setLanguage('sw');

      expect(service.translations()).toBe(before);
      expect(localStorage.getItem('hellotalk_dict_sw')).toBeNull();
    });

    it('accepts only string translations for the keys that were requested', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
        const request = JSON.parse(String(init?.body)) as TranslateUiRequest;
        const [firstKey] = Object.keys(request.dictionary);
        return Promise.resolve(
          jsonResponse({
            translations: {
              [firstKey]: '[sw] translated',
              'unrequested.key': 'injected',
              'app.title': 42,
            },
          }),
        );
      });

      await service.setLanguage('sw');

      expect(service.translate('unrequested.key')).toBe('unrequested.key');
      expect(service.translate('app.title')).toBe('HelloTalk');
    });

    it('does not fail when storage rejects the dictionary', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(echoTranslations('[sw] '));
      const setItem = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
        this: Storage,
        key: string,
        value: string,
      ) {
        if (key.startsWith('hellotalk_dict_')) throw new DOMException('Quota', 'QuotaExceededError');
        setItem.call(this, key, value);
      });

      await service.setLanguage('sw');

      expect(service.translate('app.title')).toBe('[sw] HelloTalk');
    });
  });

  describe('overlapping language changes', () => {
    it('keeps the newest selection when an older request finishes last', async () => {
      const slow: { release: () => void } = { release: () => undefined };
      const slowGate = new Promise<void>((resolve) => {
        slow.release = resolve;
      });
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const request = JSON.parse(String(init?.body)) as TranslateUiRequest;
        if (request.target_language === 'sw') await slowGate;
        return echoTranslations(`[${request.target_language}] `)(input, init);
      });

      const swahili = service.setLanguage('sw');
      const turkish = service.setLanguage('tr');
      await turkish;
      expect(service.translate('app.title')).toBe('[tr] HelloTalk');

      slow.release();
      await swahili;

      expect(service.currentLang()).toBe('tr');
      expect(service.translate('app.title')).toBe('[tr] HelloTalk');
      expect(testDocument.documentElement.lang).toBe('tr');
      // The finished Swahili dictionary is still valid for Swahili, so it is kept for later.
      expect(JSON.parse(localStorage.getItem('hellotalk_dict_sw') ?? '{}')['app.title']).toBe(
        '[sw] HelloTalk',
      );
    });

    it('does not let a slow request replace English chosen afterwards', async () => {
      const slow: { release: () => void } = { release: () => undefined };
      const slowGate = new Promise<void>((resolve) => {
        slow.release = resolve;
      });
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        await slowGate;
        return echoTranslations('[sw] ')(input, init);
      });

      const swahili = service.setLanguage('sw');
      await service.setLanguage('en-GB');
      slow.release();
      await swahili;

      expect(service.currentLang()).toBe('en-GB');
      expect(service.translate('app.title')).toBe('HelloTalk');
    });
  });
});
