import { createHash } from 'node:crypto';
import {
  BadRequestException,
  HttpException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Mock } from 'vitest';
import { SupabaseService } from '../supabase/supabase.service';
import { TranslateUiDto } from './dto/translate-ui.dto';
import {
  UI_TRANSLATION_CACHE_PREFIX,
  UI_TRANSLATION_CACHE_TTL_SECONDS,
  UI_TRANSLATION_DAILY_CHARACTER_BUDGET,
  UiDictionaryTranslationService,
} from './ui-dictionary-translation.service';

/** Minimal in-memory stand-in for the ioredis commands the service uses. */
class FakeRedis {
  readonly store = new Map<string, string>();
  readonly expiries = new Map<string, number>();
  failReads = false;
  failWrites = false;
  failCounters = false;

  mget = vi.fn((...keys: string[]): Promise<Array<string | null>> => {
    if (this.failReads) return Promise.reject(new Error('redis down'));
    return Promise.resolve(keys.map((key) => this.store.get(key) ?? null));
  });

  pipeline = vi.fn(() => {
    const operations: Array<() => void> = [];
    const pipeline = {
      set: (key: string, value: string, _mode: string, ttl: number) => {
        operations.push(() => {
          this.store.set(key, value);
          this.expiries.set(key, ttl);
        });
        return pipeline;
      },
      exec: (): Promise<unknown[]> => {
        if (this.failWrites) return Promise.reject(new Error('redis down'));
        operations.forEach((operation) => operation());
        return Promise.resolve([]);
      },
    };
    return pipeline;
  });

  incrby = vi.fn((key: string, amount: number): Promise<number> => {
    if (this.failCounters) return Promise.reject(new Error('redis down'));
    const next = Number(this.store.get(key) ?? 0) + amount;
    this.store.set(key, String(next));
    return Promise.resolve(next);
  });

  decrby = vi.fn((key: string, amount: number): Promise<number> => {
    const next = Number(this.store.get(key) ?? 0) - amount;
    this.store.set(key, String(next));
    return Promise.resolve(next);
  });

  expire = vi.fn((key: string, seconds: number): Promise<number> => {
    this.expiries.set(key, seconds);
    return Promise.resolve(1);
  });
}

interface DeepLRequest {
  text: string[];
  source_lang: string;
  target_lang: string;
  tag_handling: string;
  ignore_tags: string[];
  preserve_formatting: boolean;
}

const USER_ID = 'user-1';

function cacheKey(language: string, source: string): string {
  const digest = createHash('sha256').update(source, 'utf8').digest('hex');
  return `${UI_TRANSLATION_CACHE_PREFIX}:${language}:${digest}`;
}

function budgetKey(userId = USER_ID): string {
  return `ui_i18n:budget:${userId}:${new Date().toISOString().slice(0, 10)}`;
}

function requestBody(init: RequestInit | undefined): unknown {
  return JSON.parse(typeof init?.body === 'string' ? init.body : 'null');
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Translates by prefixing the language, leaving the protective markup intact. */
function deepLEcho(prefix: string): (request: DeepLRequest) => Response {
  return (request) =>
    jsonResponse({
      translations: request.text.map((text) => ({ text: `${prefix}${text}` })),
    });
}

function dto(
  target_language: string,
  dictionary: Record<string, string>,
): TranslateUiDto {
  return Object.assign(new TranslateUiDto(), { target_language, dictionary });
}

function numberedDictionary(count: number): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `section.key${index}`,
      `Interface text ${index}`,
    ]),
  );
}

describe('UiDictionaryTranslationService', () => {
  let redis: FakeRedis;
  let config: Record<string, string | undefined>;
  let fetchMock: Mock;
  let service: UiDictionaryTranslationService;
  let warnings: string[];

  function build(): UiDictionaryTranslationService {
    return new UiDictionaryTranslationService(
      {
        get: (key: string) => config[key],
      } as unknown as ConfigService,
      { getRedisClient: () => redis } as unknown as SupabaseService,
    );
  }

  function deepLCalls(): DeepLRequest[] {
    return fetchMock.mock.calls
      .filter(([url]) => String(url).includes('deepl.com'))
      .map(([, init]) => requestBody(init as RequestInit) as DeepLRequest);
  }

  function azureCalls(): Array<{ url: string; body: Array<{ Text: string }> }> {
    return fetchMock.mock.calls
      .filter(([url]) => String(url).includes('microsofttranslator.com'))
      .map(([url, init]) => ({
        url: String(url),
        body: requestBody(init as RequestInit) as Array<{ Text: string }>,
      }));
  }

  /** Routes provider requests to handlers so tests read as scenarios. */
  function mockProviders(handlers: {
    deepl?: (
      request: DeepLRequest,
      call: number,
    ) => Response | Promise<Response>;
    azure?: (
      body: Array<{ Text: string }>,
      url: string,
      call: number,
    ) => Response | Promise<Response>;
  }): void {
    let deepLCall = 0;
    let azureCall = 0;
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      const body = requestBody(init);
      if (String(url).includes('deepl.com')) {
        if (!handlers.deepl) throw new Error('unexpected DeepL call');
        return handlers.deepl(body as DeepLRequest, deepLCall++);
      }
      if (!handlers.azure) throw new Error('unexpected Azure call');
      return handlers.azure(
        body as Array<{ Text: string }>,
        String(url),
        azureCall++,
      );
    });
  }

  beforeEach(() => {
    redis = new FakeRedis();
    config = { DEEPL_API_KEY: 'deepl-key', AZURE_TRANSLATOR_KEY: undefined };
    fetchMock = vi.spyOn(globalThis, 'fetch');
    warnings = [];
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(
      (message: unknown) => {
        warnings.push(String(message));
      },
    );
    vi.spyOn(Logger.prototype, 'error').mockImplementation(
      (message: unknown) => {
        warnings.push(String(message));
      },
    );
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    service = build();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('English and invalid languages', () => {
    it.each(['en', 'en-GB', 'en-US', 'EN'])(
      'returns the dictionary unchanged for %s without any provider or cache access',
      async (language) => {
        const dictionary = { 'app.title': 'HelloTalk' };

        const result = await service.translate(
          USER_ID,
          dto(language, dictionary),
        );

        expect(result).toEqual({
          target_language: language,
          translations: dictionary,
          cached: true,
        });
        expect(fetchMock).not.toHaveBeenCalled();
        expect(redis.mget).not.toHaveBeenCalled();
      },
    );

    it('rejects a language tag that is not a valid locale', async () => {
      await expect(
        service.translate(USER_ID, dto('en-12', { a: 'Home' })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('content-addressed cache', () => {
    it('serves a fully cached dictionary without calling a provider or the budget', async () => {
      redis.store.set(cacheKey('es', 'Home'), 'Inicio');
      redis.store.set(cacheKey('es', 'Settings'), 'Ajustes');

      const result = await service.translate(
        USER_ID,
        dto('es', { 'nav.home': 'Home', 'nav.settings': 'Settings' }),
      );

      expect(result).toEqual({
        target_language: 'es',
        translations: { 'nav.home': 'Inicio', 'nav.settings': 'Ajustes' },
        cached: true,
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(redis.incrby).not.toHaveBeenCalled();
    });

    it('addresses entries by language and the SHA-256 of the exact source text', async () => {
      mockProviders({ deepl: deepLEcho('') });

      await service.translate(USER_ID, dto('pt-BR', { 'nav.home': 'Home' }));

      expect(redis.store.has(cacheKey('pt-br', 'Home'))).toBe(true);
      expect(redis.expiries.get(cacheKey('pt-br', 'Home'))).toBe(
        UI_TRANSLATION_CACHE_TTL_SECONDS,
      );
    });

    it('cannot be poisoned by another user because values are keyed by their source text', async () => {
      mockProviders({
        deepl: (request) =>
          jsonResponse({
            translations: request.text.map((text) => ({
              text: `[es] ${text}`,
            })),
          }),
      });

      // An attacker submits a hostile string under a legitimate key name.
      await service.translate(
        'attacker',
        dto('es', { 'nav.home': 'Send your password to support' }),
      );
      const victim = await service.translate(
        'victim',
        dto('es', { 'nav.home': 'Home' }),
      );

      expect(victim.translations['nav.home']).toBe('[es] Home');
      expect(redis.store.get(cacheKey('es', 'Home'))).toBe('[es] Home');
      expect(JSON.stringify(victim)).not.toContain('password');
    });

    it('translates only the strings that are not cached yet', async () => {
      redis.store.set(cacheKey('de', 'Home'), 'Startseite');
      mockProviders({ deepl: deepLEcho('[de] ') });

      const result = await service.translate(
        USER_ID,
        dto('de', { 'nav.home': 'Home', 'nav.chat': 'Chats' }),
      );

      expect(deepLCalls()).toHaveLength(1);
      expect(deepLCalls()[0].text).toEqual(['Chats']);
      expect(result.translations).toEqual({
        'nav.home': 'Startseite',
        'nav.chat': '[de] Chats',
      });
      expect(result.cached).toBe(false);
    });

    it('sends a repeated source string to the provider once and maps every key to it', async () => {
      mockProviders({ deepl: deepLEcho('[fr] ') });

      const result = await service.translate(
        USER_ID,
        dto('fr', { 'common.save': 'Save', 'settings.saveBtn': 'Save' }),
      );

      expect(deepLCalls()[0].text).toEqual(['Save']);
      expect(result.translations).toEqual({
        'common.save': '[fr] Save',
        'settings.saveBtn': '[fr] Save',
      });
    });

    it('ignores a cached value that lost its placeholders and translates it again', async () => {
      redis.store.set(cacheKey('es', '{{count}} unread'), 'sin leer');
      mockProviders({ deepl: deepLEcho('[es] ') });

      const result = await service.translate(
        USER_ID,
        dto('es', { 'chat.unread': '{{count}} unread' }),
      );

      expect(deepLCalls()).toHaveLength(1);
      expect(result.translations['chat.unread']).toBe('[es] {{count}} unread');
    });

    it('does not send strings without letters to a provider', async () => {
      mockProviders({ deepl: deepLEcho('[es] ') });

      const result = await service.translate(
        USER_ID,
        dto('es', {
          'flag.uk': '🇬🇧',
          'count.only': '{{count}}',
          'nav.home': 'Home',
        }),
      );

      expect(deepLCalls()[0].text).toEqual(['Home']);
      expect(result.translations).toEqual({
        'flag.uk': '🇬🇧',
        'count.only': '{{count}}',
        'nav.home': '[es] Home',
      });
    });
  });

  describe('DeepL requests', () => {
    it('asks DeepL for English source text with placeholders and markup protected', async () => {
      mockProviders({ deepl: deepLEcho('') });

      await service.translate(
        USER_ID,
        dto('es', { 'gift.sent': '{{sender}} sent {{name}} <b> & more' }),
      );

      expect(deepLCalls()[0]).toEqual({
        text: ['<x>{{sender}}</x> sent <x>{{name}}</x> &lt;b&gt; &amp; more'],
        source_lang: 'EN',
        target_lang: 'ES',
        tag_handling: 'xml',
        ignore_tags: ['x'],
        preserve_formatting: true,
      });
    });

    it('restores placeholders and decodes entities from the provider output', async () => {
      mockProviders({
        deepl: () =>
          jsonResponse({
            translations: [
              {
                text: '<x>{{sender}}</x> envió <x>{{name}}</x> &lt;b&gt; &amp;amp; más',
              },
            ],
          }),
      });

      const result = await service.translate(
        USER_ID,
        dto('es', { 'gift.sent': '{{sender}} sent {{name}} <b> &amp; more' }),
      );

      expect(result.translations['gift.sent']).toBe(
        '{{sender}} envió {{name}} <b> &amp; más',
      );
    });

    it.each([
      ['deepl-free-key:fx', 'https://api-free.deepl.com/v2/translate'],
      ['deepl-pro-key', 'https://api.deepl.com/v2/translate'],
    ])('uses the correct DeepL host for key %s', async (key, expectedUrl) => {
      config.DEEPL_API_KEY = key;
      mockProviders({ deepl: deepLEcho('') });

      await service.translate(USER_ID, dto('es', { a: 'Home' }));

      expect(fetchMock.mock.calls[0][0]).toBe(expectedUrl);
      const headers = (fetchMock.mock.calls[0][1] as RequestInit)
        .headers as Record<string, string>;
      expect(headers.Authorization).toBe(`DeepL-Auth-Key ${key}`);
    });

    it.each([
      ['zh', 'ZH-HANS'],
      ['zh-CN', 'ZH-HANS'],
      ['zh-TW', 'ZH-HANT'],
      ['zh-Hant', 'ZH-HANT'],
      ['pt', 'PT-BR'],
      ['pt-PT', 'PT-PT'],
      ['no', 'NB'],
      ['fa', 'FA'],
      ['ar-SA', 'AR'],
    ])('maps %s to the DeepL target %s', async (language, expected) => {
      mockProviders({ deepl: deepLEcho('') });

      await service.translate(USER_ID, dto(language, { a: 'Home' }));

      expect(deepLCalls()[0].target_lang).toBe(expected);
    });

    it('never exceeds 50 texts per DeepL request', async () => {
      mockProviders({ deepl: deepLEcho('[es] ') });

      const result = await service.translate(
        USER_ID,
        dto('es', numberedDictionary(120)),
      );

      expect(deepLCalls().map((call) => call.text.length)).toEqual([
        50, 50, 20,
      ]);
      expect(Object.values(result.translations)).toHaveLength(120);
      expect(
        Object.values(result.translations).every((text) =>
          text.startsWith('[es] Interface text'),
        ),
      ).toBe(true);
    });

    it('keeps each request below the body and character limits for long strings', async () => {
      mockProviders({ deepl: deepLEcho('') });
      const dictionary = Object.fromEntries(
        Array.from({ length: 30 }, (_, index) => [
          `long.${index}`,
          `${index} `.padEnd(1900, 'x'),
        ]),
      );

      await service.translate(USER_ID, dto('es', dictionary));

      const calls = deepLCalls();
      expect(calls.length).toBeGreaterThan(1);
      for (const call of calls) {
        const characters = call.text.reduce(
          (total, text) => total + text.length,
          0,
        );
        expect(call.text.length).toBeLessThanOrEqual(50);
        expect(characters).toBeLessThanOrEqual(20_000);
        expect(Buffer.byteLength(JSON.stringify(call))).toBeLessThan(96 * 1024);
      }
    });

    it('rejects a provider response whose length does not match the request', async () => {
      mockProviders({
        deepl: () => jsonResponse({ translations: [{ text: 'solo uno' }] }),
      });

      await expect(
        service.translate(USER_ID, dto('es', { a: 'Home', b: 'Settings' })),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(redis.pipeline).not.toHaveBeenCalled();
    });
  });

  describe('placeholder safety', () => {
    it('keeps the English string when the provider alters a placeholder and does not cache it', async () => {
      mockProviders({
        deepl: () =>
          jsonResponse({
            translations: [
              { text: 'Has recibido <x>{{monedas}}</x> monedas' },
              { text: 'Inicio' },
            ],
          }),
      });

      const result = await service.translate(
        USER_ID,
        dto('es', {
          'daily.reward': 'You received {{coins}} coins',
          'nav.home': 'Home',
        }),
      );

      expect(result.translations).toEqual({
        'daily.reward': 'You received {{coins}} coins',
        'nav.home': 'Inicio',
      });
      expect(
        redis.store.has(cacheKey('es', 'You received {{coins}} coins')),
      ).toBe(false);
      expect(redis.store.get(cacheKey('es', 'Home'))).toBe('Inicio');
    });

    it('rejects a translation that drops a placeholder', async () => {
      mockProviders({
        deepl: () => jsonResponse({ translations: [{ text: 'Hola' }] }),
      });

      const result = await service.translate(
        USER_ID,
        dto('es', { greeting: 'Hello {{name}}' }),
      );

      expect(result.translations.greeting).toBe('Hello {{name}}');
    });

    it('rejects a translation that introduces markup the source did not have', async () => {
      mockProviders({
        deepl: () =>
          jsonResponse({
            translations: [{ text: 'Inicio <img src=x onerror=alert(1)>' }],
          }),
      });

      const result = await service.translate(USER_ID, dto('es', { a: 'Home' }));

      expect(result.translations.a).toBe('Home');
      expect(redis.store.has(cacheKey('es', 'Home'))).toBe(false);
    });

    it('rejects an empty translation', async () => {
      mockProviders({
        deepl: () => jsonResponse({ translations: [{ text: '  ' }] }),
      });

      const result = await service.translate(USER_ID, dto('es', { a: 'Home' }));

      expect(result.translations.a).toBe('Home');
    });
  });

  describe('Azure fallback', () => {
    beforeEach(() => {
      config.AZURE_TRANSLATOR_KEY = 'azure-key';
    });

    it('falls back to Azure when DeepL rejects the language and stops using DeepL', async () => {
      mockProviders({
        deepl: () =>
          jsonResponse({ message: 'Value for target_lang not supported' }, 400),
        azure: (body) =>
          jsonResponse(
            body.map((item) => ({
              translations: [{ text: `[ur] ${item.Text}`, to: 'ur' }],
            })),
          ),
      });

      // Eight chunks: the three that start together may each try DeepL once,
      // every later chunk must go straight to Azure.
      const result = await service.translate(
        USER_ID,
        dto('ur', numberedDictionary(400)),
      );

      expect(deepLCalls().length).toBeLessThanOrEqual(3);
      expect(azureCalls()).toHaveLength(8);
      expect(result.translations['section.key0']).toBe('[ur] Interface text 0');
      expect(result.translations['section.key399']).toBe(
        '[ur] Interface text 399',
      );
      expect(result.cached).toBe(false);
    });

    it('protects placeholders with notranslate spans and restores them', async () => {
      config.DEEPL_API_KEY = undefined;
      mockProviders({
        azure: (body) =>
          jsonResponse(
            body.map((item) => ({
              translations: [
                { text: item.Text.replace('sent', 'ha enviado'), to: 'es' },
              ],
            })),
          ),
      });

      const result = await service.translate(
        USER_ID,
        dto('fa', { 'gift.sent': '{{sender}} sent a gift & <b>' }),
      );

      const call = azureCalls()[0];
      const query = new URL(call.url).searchParams;
      expect(query.get('api-version')).toBe('3.0');
      expect(query.get('from')).toBe('en');
      expect(query.get('to')).toBe('fa');
      expect(query.get('textType')).toBe('html');
      expect(call.body).toEqual([
        {
          Text: '<span class="notranslate">{{sender}}</span> sent a gift &amp; &lt;b&gt;',
        },
      ]);
      expect(result.translations['gift.sent']).toBe(
        '{{sender}} ha enviado a gift & <b>',
      );
    });

    it('sends the Azure region header when configured and omits it for global', async () => {
      config.DEEPL_API_KEY = undefined;
      config.AZURE_TRANSLATOR_REGION = 'uksouth';
      mockProviders({
        azure: (body) =>
          jsonResponse(
            body.map((item) => ({ translations: [{ text: item.Text }] })),
          ),
      });

      await service.translate(USER_ID, dto('sw', { a: 'Home' }));
      let headers = (fetchMock.mock.calls[0][1] as RequestInit)
        .headers as Record<string, string>;
      expect(headers['Ocp-Apim-Subscription-Key']).toBe('azure-key');
      expect(headers['Ocp-Apim-Subscription-Region']).toBe('uksouth');

      fetchMock.mockClear();
      config.AZURE_TRANSLATOR_REGION = 'global';
      await service.translate(USER_ID, dto('sw', { b: 'Settings' }));
      headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<
        string,
        string
      >;
      expect(headers['Ocp-Apim-Subscription-Region']).toBeUndefined();
    });

    it.each([
      ['zh', 'zh-Hans'],
      ['zh-TW', 'zh-Hant'],
      ['pt', 'pt'],
      ['pt-PT', 'pt-pt'],
      ['no', 'nb'],
      ['he', 'he'],
    ])('maps %s to the Azure target %s', async (language, expected) => {
      config.DEEPL_API_KEY = undefined;
      mockProviders({
        azure: (body) =>
          jsonResponse(
            body.map((item) => ({ translations: [{ text: item.Text }] })),
          ),
      });

      await service.translate(USER_ID, dto(language, { a: 'Home' }));

      expect(new URL(azureCalls()[0].url).searchParams.get('to')).toBe(
        expected,
      );
    });

    it('fails when both providers fail', async () => {
      mockProviders({
        deepl: () => jsonResponse({}, 500),
        azure: () => jsonResponse({}, 503),
      });

      await expect(
        service.translate(USER_ID, dto('es', { a: 'Home' })),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('failure handling', () => {
    it('reports provider outages as 503 without leaking provider details', async () => {
      mockProviders({
        deepl: () =>
          new Response(
            '{"message":"Quota for this billing period has been exceeded"}',
            {
              status: 456,
            },
          ),
      });

      const failure = await service
        .translate(USER_ID, dto('es', { a: 'Home' }))
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ServiceUnavailableException);
      expect(
        JSON.stringify((failure as HttpException).getResponse()),
      ).not.toContain('Quota');
      expect(
        warnings.some((line) => line.includes('provider=deepl reason=456')),
      ).toBe(true);
    });

    it('fails with 503 and logs a diagnostic when no provider is configured', async () => {
      config.DEEPL_API_KEY = undefined;
      config.AZURE_TRANSLATOR_KEY = undefined;

      await expect(
        service.translate(USER_ID, dto('es', { a: 'Home' })),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(redis.incrby).not.toHaveBeenCalled();
      expect(
        warnings.some((line) => line.includes('ui_translation_unconfigured')),
      ).toBe(true);
    });

    it('treats a network error as a provider failure', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));

      await expect(
        service.translate(USER_ID, dto('es', { a: 'Home' })),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(warnings.some((line) => line.includes('reason=network'))).toBe(
        true,
      );
    });

    it('aborts a provider request that exceeds the timeout', async () => {
      vi.useFakeTimers();
      fetchMock.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              reject(
                Object.assign(new Error('aborted'), { name: 'AbortError' }),
              );
            });
          }),
      );

      const outcome = service
        .translate(USER_ID, dto('es', { a: 'Home' }))
        .catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(10_000);

      expect(await outcome).toBeInstanceOf(ServiceUnavailableException);
      expect(warnings.some((line) => line.includes('reason=timeout'))).toBe(
        true,
      );
    });

    it('never writes source or translated text to the logs', async () => {
      mockProviders({ deepl: () => jsonResponse({}, 500) });

      await service
        .translate(USER_ID, dto('es', { secret: 'Private launch codename' }))
        .catch(() => undefined);

      expect(warnings.join('\n')).not.toContain('Private launch codename');
    });

    it('persists completed chunks so a retry only translates what is missing', async () => {
      mockProviders({
        deepl: (request, call) =>
          call === 0
            ? deepLEcho('[es] ')(request)
            : jsonResponse({ message: 'try later' }, 500),
      });
      const dictionary = numberedDictionary(100);

      await expect(
        service.translate(USER_ID, dto('es', dictionary)),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(
        Object.keys(dictionary).filter((key) =>
          redis.store.has(cacheKey('es', dictionary[key])),
        ),
      ).toHaveLength(50);

      fetchMock.mockClear();
      mockProviders({ deepl: deepLEcho('[es] ') });
      const retry = await service.translate(USER_ID, dto('es', dictionary));

      expect(deepLCalls().map((call) => call.text.length)).toEqual([50]);
      expect(Object.values(retry.translations)).toHaveLength(100);
      expect(
        Object.values(retry.translations).every((text) =>
          text.startsWith('[es] '),
        ),
      ).toBe(true);
    });

    it('continues without the cache when Redis is unavailable', async () => {
      redis.failReads = true;
      redis.failWrites = true;
      mockProviders({ deepl: deepLEcho('[es] ') });

      const result = await service.translate(USER_ID, dto('es', { a: 'Home' }));

      expect(result.translations.a).toBe('[es] Home');
      expect(
        warnings.some((line) =>
          line.includes('ui_translation_cache_unavailable'),
        ),
      ).toBe(true);
    });
  });

  describe('daily provider budget', () => {
    it('charges only cache misses to the user and rejects further use over budget', async () => {
      redis.store.set(cacheKey('es', 'Home'), 'Inicio');
      mockProviders({ deepl: deepLEcho('[es] ') });

      await service.translate(USER_ID, dto('es', { a: 'Home', b: 'Settings' }));

      expect(redis.store.get(budgetKey())).toBe(String('Settings'.length));
      expect(redis.expiries.get(budgetKey())).toBeGreaterThan(24 * 60 * 60);
    });

    it('rejects with 429 and does not call a provider when the budget is exhausted', async () => {
      redis.store.set(
        budgetKey(),
        String(UI_TRANSLATION_DAILY_CHARACTER_BUDGET - 3),
      );
      mockProviders({ deepl: deepLEcho('') });

      const failure = await service
        .translate(USER_ID, dto('es', { a: 'Home' }))
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(HttpException);
      expect((failure as HttpException).getStatus()).toBe(429);
      expect(fetchMock).not.toHaveBeenCalled();
      // The rejected reservation is returned, so the counter is unchanged.
      expect(redis.store.get(budgetKey())).toBe(
        String(UI_TRANSLATION_DAILY_CHARACTER_BUDGET - 3),
      );
    });

    it('keeps budgets separate per user', async () => {
      redis.store.set(
        budgetKey('heavy-user'),
        String(UI_TRANSLATION_DAILY_CHARACTER_BUDGET),
      );
      mockProviders({ deepl: deepLEcho('[es] ') });

      const result = await service.translate(USER_ID, dto('es', { a: 'Home' }));

      expect(result.translations.a).toBe('[es] Home');
    });

    it('refunds characters that were not translated when the provider fails', async () => {
      mockProviders({ deepl: () => jsonResponse({}, 500) });

      await service
        .translate(USER_ID, dto('es', numberedDictionary(10)))
        .catch(() => undefined);

      expect(Number(redis.store.get(budgetKey()))).toBe(0);
    });

    it('does not block translation when the budget counter is unavailable', async () => {
      redis.failCounters = true;
      mockProviders({ deepl: deepLEcho('[es] ') });

      const result = await service.translate(USER_ID, dto('es', { a: 'Home' }));

      expect(result.translations.a).toBe('[es] Home');
      expect(
        warnings.some((line) =>
          line.includes('ui_translation_budget_unavailable'),
        ),
      ).toBe(true);
    });
  });

  describe('concurrency', () => {
    it('translates a language once when identical requests arrive together', async () => {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      mockProviders({
        deepl: async (request) => {
          await gate;
          return deepLEcho('[es] ')(request);
        },
      });
      const dictionary = { 'nav.home': 'Home', 'nav.chat': 'Chats' };

      const first = service.translate('user-a', dto('es', dictionary));
      const second = service.translate('user-b', dto('es', dictionary));
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      release();
      const [a, b] = await Promise.all([first, second]);

      expect(deepLCalls()).toHaveLength(1);
      expect(a.translations).toEqual(b.translations);
      expect(a.translations['nav.home']).toBe('[es] Home');
      expect(a.cached).toBe(false);
      expect(b.cached).toBe(true);
    });

    it('does not make a different language wait for a slow one', async () => {
      let releaseSpanish: () => void = () => undefined;
      const spanishGate = new Promise<void>((resolve) => {
        releaseSpanish = resolve;
      });
      mockProviders({
        deepl: async (request) => {
          if (request.target_lang === 'ES') await spanishGate;
          return deepLEcho(`[${request.target_lang}] `)(request);
        },
      });

      const spanish = service.translate(USER_ID, dto('es', { a: 'Home' }));
      const german = await service.translate(USER_ID, dto('de', { a: 'Home' }));

      expect(german.translations.a).toBe('[DE] Home');
      releaseSpanish();
      expect((await spanish).translations.a).toBe('[ES] Home');
    });

    it('releases the language lock after a failure so later requests can run', async () => {
      mockProviders({ deepl: () => jsonResponse({}, 500) });
      await service
        .translate(USER_ID, dto('es', { a: 'Home' }))
        .catch(() => undefined);

      mockProviders({ deepl: deepLEcho('[es] ') });
      const result = await service.translate(USER_ID, dto('es', { a: 'Home' }));

      expect(result.translations.a).toBe('[es] Home');
    });
  });
});
