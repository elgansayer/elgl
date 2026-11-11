import type { Mock } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../metrics/metrics.service';
import { NlpService } from './nlp.service';
import { TranslationRouterService } from './translation-router.service';

describe('TranslationRouterService', () => {
  let service: TranslationRouterService;
  let configValues: Record<string, string | undefined>;
  let nlpService: {
    checkRateLimit: Mock;
    detectLanguage: Mock;
  };

  beforeEach(() => {
    configValues = {
      DEEPL_API_KEY: 'deepl-test:fx',
      AZURE_TRANSLATOR_KEY: 'azure-test',
      AZURE_TRANSLATOR_REGION: 'westeurope',
    };
    nlpService = {
      checkRateLimit: vi.fn().mockResolvedValue(undefined),
      detectLanguage: vi
        .fn()
        .mockReturnValue({ language: 'en', confidence: 0.99 }),
    };
    const configService = {
      get: vi.fn((key: string) => configValues[key]),
    };

    service = new TranslationRouterService(
      configService as unknown as ConfigService,
      nlpService as unknown as NlpService,
    );
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('routes translation to DeepL first and adds Azure transliteration for non-Latin output', async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          translations: [
            {
              detected_source_language: 'EN',
              text: 'こんにちは',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue([{ text: "Kon'nichiwa" }]),
      });

    const result = await service.translate('user-1', false, {
      text: 'hello',
      source_language: 'en',
      target_language: 'ja',
    });

    expect(result).toMatchObject({
      original_text: 'hello',
      translated_text: 'こんにちは',
      detected_language: 'en',
      transliteration: "Kon'nichiwa",
    });
    expect(nlpService.checkRateLimit).toHaveBeenCalledOnce();
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const firstCallUrl = (global.fetch as Mock).mock.calls[0][0];
    expect(firstCallUrl).toBe('https://api-free.deepl.com/v2/translate');

    const transliterationUrl = (global.fetch as Mock).mock.calls[1][0];
    expect(transliterationUrl).toContain('/transliterate?');
    expect(transliterationUrl).toContain('language=ja');
    expect(transliterationUrl).toContain('fromScript=Jpan');
    expect(transliterationUrl).toContain('toScript=Latn');
  });

  it('falls back to Azure Translator when DeepL is unavailable', async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue([
          {
            detectedLanguage: { language: 'es', score: 1 },
            translations: [{ text: 'Hello', to: 'en' }],
          },
        ]),
      });

    const result = await service.translate('user-1', true, {
      text: 'Hola',
      source_language: 'es',
      target_language: 'en',
    });

    expect(result.translated_text).toBe('Hello');
    expect(result.detected_language).toBe('es');
    expect(result.transliteration).toBe('Hello');
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const azureUrl = (global.fetch as Mock).mock.calls[1][0];
    const azureInit = (global.fetch as Mock).mock.calls[1][1];
    expect(azureUrl).toContain('/translate?');
    expect(azureUrl).toContain('from=es');
    expect(azureUrl).toContain('to=en');
    expect(azureInit.headers).toMatchObject({
      'Ocp-Apim-Subscription-Key': 'azure-test',
      'Ocp-Apim-Subscription-Region': 'westeurope',
    });
  });

  it('uses local language detection when no source language is supplied', async () => {
    nlpService.detectLanguage.mockReturnValue({
      language: 'fr',
      confidence: 0.95,
    });
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        translations: [{ detected_source_language: 'FR', text: 'Hello' }],
      }),
    });

    await service.translate('user-1', true, {
      text: 'Bonjour',
      target_language: 'en',
    });

    expect(nlpService.detectLanguage).toHaveBeenCalledWith('Bonjour');
    const requestInit = (global.fetch as Mock).mock.calls[0][1];
    expect(JSON.parse(requestInit.body)).toMatchObject({ source_lang: 'FR' });
  });

  it('fails visibly instead of returning the source text when every provider is unavailable', async () => {
    configValues.DEEPL_API_KEY = undefined;
    configValues.AZURE_TRANSLATOR_KEY = undefined;

    await expect(
      service.translate('user-1', false, {
        text: 'Bonjour',
        source_language: 'fr',
        target_language: 'en',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(nlpService.checkRateLimit).toHaveBeenCalledOnce();
  });

  it('times out when a provider stalls while returning its response body', async () => {
    vi.useFakeTimers();
    configValues.AZURE_TRANSLATOR_KEY = undefined;
    (global.fetch as Mock).mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            new Promise((_resolve, reject) => {
              init.signal?.addEventListener('abort', () =>
                reject(new DOMException('Aborted', 'AbortError')),
              );
            }),
        }),
    );

    const translation = service.translate('user-1', false, {
      text: 'Bonjour',
      source_language: 'fr',
      target_language: 'en',
    });

    const unavailable = expect(translation).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    await vi.advanceTimersByTimeAsync(10_000);
    await unavailable;
  });

  it('transliterates an explicit Azure language and ISO 15924 script pair', async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([{ text: 'privet' }]),
    });

    const result = await service.transliterate('user-1', false, {
      text: 'привет',
      language: 'ru',
      from_script: 'cyrl',
      to_script: 'latn',
    });

    expect(result).toEqual({
      original_text: 'привет',
      transliterated_text: 'privet',
      language: 'ru',
      from_script: 'Cyrl',
      to_script: 'Latn',
    });
    expect(nlpService.checkRateLimit).toHaveBeenCalledOnce();

    const requestUrl = (global.fetch as Mock).mock.calls[0][0];
    expect(requestUrl).toContain('language=ru');
    expect(requestUrl).toContain('fromScript=Cyrl');
    expect(requestUrl).toContain('toScript=Latn');
  });

  it('returns a validation error when Azure rejects an explicit script pair', async () => {
    (global.fetch as Mock).mockResolvedValueOnce({ ok: false, status: 400 });

    await expect(
      service.transliterate('user-1', true, {
        text: 'hello',
        language: 'en',
        from_script: 'Latn',
        to_script: 'Cyrl',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns service unavailable when explicit transliteration has no configured provider', async () => {
    configValues.AZURE_TRANSLATOR_KEY = undefined;

    await expect(
      service.transliterate('user-1', true, {
        text: 'こんにちは',
        language: 'ja',
        from_script: 'Jpan',
        to_script: 'Latn',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not send a global Azure pseudo-region header', async () => {
    configValues.DEEPL_API_KEY = undefined;
    configValues.AZURE_TRANSLATOR_REGION = 'global';
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi
        .fn()
        .mockResolvedValue([{ translations: [{ text: 'Hello', to: 'en' }] }]),
    });

    await service.translate('user-1', true, {
      text: 'Hola',
      source_language: 'es',
      target_language: 'en',
    });

    const requestInit = (global.fetch as Mock).mock.calls[0][1];
    expect(requestInit.headers).not.toHaveProperty(
      'Ocp-Apim-Subscription-Region',
    );
  });
  describe('PII scrubbing before DeepL and Azure', () => {
    const email = 'john.doe@example.com';
    const phone = '+44 7700 900123';
    const message = `Contact me at ${email} or call ${phone}`;
    const placeholderPattern = /PII[A-Z]{8}\d+Z/;
    let warn: Mock;
    let debug: Mock;

    beforeEach(() => {
      warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => {}) as Mock;
      debug = vi
        .spyOn(Logger.prototype, 'debug')
        .mockImplementation(() => {}) as Mock;
    });

    function bodyOf(init: RequestInit): string {
      return typeof init.body === 'string' ? init.body : '';
    }

    /** Resolves every provider call with the response `build` makes from its request. */
    function mockProvider(
      build: (url: string, init: RequestInit) => object,
    ): void {
      (global.fetch as Mock).mockImplementation(
        (url: string, init: RequestInit) => Promise.resolve(build(url, init)),
      );
    }

    function placeholderOf(text: string): string {
      const match = placeholderPattern.exec(text);
      if (!match) throw new Error('The provider request has no placeholder');
      return match[0];
    }

    function requestBody(callIndex: number): string {
      return String((global.fetch as Mock).mock.calls[callIndex][1].body);
    }

    function requestUrl(callIndex: number): string {
      return String((global.fetch as Mock).mock.calls[callIndex][0]);
    }

    /** The text DeepL received in the nth call. */
    function deepLText(callIndex: number): string {
      return JSON.parse(requestBody(callIndex)).text[0];
    }

    /** The text Azure received in the nth call. */
    function azureText(callIndex: number): string {
      return JSON.parse(requestBody(callIndex))[0].Text;
    }

    function expectNoSensitiveData(callIndex: number): void {
      const body = requestBody(callIndex);
      for (const sensitive of ['john', 'example.com', '7700', '900123']) {
        expect(body).not.toContain(sensitive);
      }
    }

    function deepLResponse(text: string): object {
      return {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          translations: [{ detected_source_language: 'EN', text }],
        }),
      };
    }

    function azureResponse(text: string): object {
      return {
        ok: true,
        status: 200,
        json: vi
          .fn()
          .mockResolvedValue([{ translations: [{ text, to: 'es' }] }]),
      };
    }

    it('never sends the email or phone number to DeepL and restores them in the translation', async () => {
      mockProvider((_url, init) =>
        deepLResponse(
          JSON.parse(bodyOf(init))
            .text[0].replace('Contact me at', 'Contáctame en')
            .replace('or call', 'o llama al'),
        ),
      );

      const result = await service.translate('user-1', false, {
        text: message,
        source_language: 'en',
        target_language: 'es',
      });

      expect(result.translated_text).toBe(
        `Contáctame en ${email} o llama al ${phone}`,
      );
      expect(result.original_text).toBe(message);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expectNoSensitiveData(0);
      expect(deepLText(0)).toMatch(
        /^Contact me at PII[A-Z]{8}0Z or call PII[A-Z]{8}1Z$/,
      );
    });

    it('retries Azure with a fresh masked request when DeepL damages a placeholder', async () => {
      mockProvider((url: string, init) =>
        url.includes('deepl')
          ? deepLResponse('Contáctame mañana')
          : azureResponse(
              `Contáctame en ${placeholderOf(JSON.parse(bodyOf(init))[0].Text)}`,
            ),
      );

      const result = await service.translate('user-1', false, {
        text: `Contact me at ${email}`,
        source_language: 'en',
        target_language: 'es',
      });

      expect(result.translated_text).toBe(`Contáctame en ${email}`);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(requestUrl(0)).toContain('deepl');
      expect(requestUrl(1)).toContain('microsofttranslator');
      expectNoSensitiveData(0);
      expectNoSensitiveData(1);
      expect(warn).toHaveBeenCalledWith(
        'pii_placeholder_mismatch provider=deepl operation=translate redactions=1',
      );
      expect(placeholderOf(azureText(1))).not.toBe(placeholderOf(deepLText(0)));
    });

    it('fails visibly when no provider returns the placeholder intact', async () => {
      mockProvider((url: string) =>
        url.includes('deepl')
          ? deepLResponse('Contáctame mañana')
          : azureResponse('Contáctame mañana'),
      );

      await expect(
        service.translate('user-1', false, {
          text: `Contact me at ${email}`,
          source_language: 'en',
          target_language: 'es',
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expectNoSensitiveData(0);
      expectNoSensitiveData(1);
    });

    it('does not call a provider when only sensitive data would be sent', async () => {
      const result = await service.translate('user-1', false, {
        text: email,
        source_language: 'en',
        target_language: 'es',
      });

      expect(result.translated_text).toBe(email);
      expect(result.detected_language).toBe('en');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('still reports an unavailable service for sensitive-only text when no provider is configured', async () => {
      configValues.DEEPL_API_KEY = undefined;
      configValues.AZURE_TRANSLATOR_KEY = undefined;

      await expect(
        service.translate('user-1', false, {
          text: email,
          source_language: 'en',
          target_language: 'es',
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('masks the text Azure receives when DeepL is not configured', async () => {
      configValues.DEEPL_API_KEY = undefined;
      mockProvider((_url, init) =>
        azureResponse(JSON.parse(bodyOf(init))[0].Text),
      );

      const result = await service.translate('user-1', false, {
        text: message,
        source_language: 'en',
        target_language: 'es',
      });

      expect(result.translated_text).toBe(message);
      expectNoSensitiveData(0);
    });

    it('does not send the restored values to Azure for automatic transliteration', async () => {
      mockProvider((url: string, init) =>
        url.includes('deepl')
          ? deepLResponse(
              `メール ${placeholderOf(JSON.parse(bodyOf(init)).text[0])}`,
            )
          : {
              ok: true,
              status: 200,
              json: vi.fn().mockResolvedValue([{ text: 'meeru' }]),
            },
      );

      const result = await service.translate('user-1', false, {
        text: `Email ${email}`,
        source_language: 'en',
        target_language: 'ja',
      });

      expect(result.translated_text).toBe(`メール ${email}`);
      expect(result.transliteration).toBe(`meeru ${email}`);
      expect(requestUrl(1)).toContain('/transliterate?');
      expectNoSensitiveData(1);
      expect(JSON.parse(requestBody(1))).toEqual([{ Text: 'メール ' }]);
    });

    it('sends only the non-sensitive pieces for explicit transliteration and keeps the values', async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue([{ text: 'privet' }, { text: 'poka' }]),
      });

      const result = await service.transliterate('user-1', false, {
        text: `привет ${email} пока`,
        language: 'ru',
        from_script: 'Cyrl',
        to_script: 'Latn',
      });

      expect(JSON.parse(requestBody(0))).toEqual([
        { Text: 'привет ' },
        { Text: ' пока' },
      ]);
      expect(result.transliterated_text).toBe(`privet ${email} poka`);
      expect(result.original_text).toBe(`привет ${email} пока`);
      expectNoSensitiveData(0);
    });

    it('does not call Azure to transliterate sensitive-only text', async () => {
      const result = await service.transliterate('user-1', false, {
        text: `${email} ${phone}`,
        language: 'ru',
        from_script: 'Cyrl',
        to_script: 'Latn',
      });

      expect(result.transliterated_text).toBe(`${email} ${phone}`);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects a transliteration response that does not match the segments sent', async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue([{ text: 'privet' }]),
      });

      await expect(
        service.transliterate('user-1', false, {
          text: `привет ${email} пока`,
          language: 'ru',
          from_script: 'Cyrl',
          to_script: 'Latn',
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('receives the metrics service from the Nest container', async () => {
      const metrics = {
        recordPiiScrub: vi.fn(),
        recordPiiRedactions: vi.fn(),
      };
      const module = await Test.createTestingModule({
        providers: [
          TranslationRouterService,
          {
            provide: ConfigService,
            useValue: { get: vi.fn((key: string) => configValues[key]) },
          },
          { provide: NlpService, useValue: nlpService },
          { provide: MetricsService, useValue: metrics },
        ],
      }).compile();
      mockProvider((_url, init) =>
        deepLResponse(JSON.parse(bodyOf(init)).text[0]),
      );

      await module.get(TranslationRouterService).translate('user-1', false, {
        text: message,
        source_language: 'en',
        target_language: 'es',
      });

      expect(metrics.recordPiiScrub).toHaveBeenCalledWith(
        'deepl',
        'translate',
        'redacted',
      );
    });

    it('records value-free metrics and logs', async () => {
      const metrics = {
        recordPiiScrub: vi.fn(),
        recordPiiRedactions: vi.fn(),
      };
      const instrumented = new TranslationRouterService(
        {
          get: vi.fn((key: string) => configValues[key]),
        } as unknown as ConfigService,
        nlpService as unknown as NlpService,
        metrics as unknown as MetricsService,
      );
      mockProvider((_url, init) =>
        deepLResponse(JSON.parse(bodyOf(init)).text[0]),
      );

      await instrumented.translate('user-1', false, {
        text: message,
        source_language: 'en',
        target_language: 'es',
      });

      expect(metrics.recordPiiScrub).toHaveBeenCalledWith(
        'deepl',
        'translate',
        'redacted',
      );
      expect(metrics.recordPiiRedactions).toHaveBeenCalledWith(
        'deepl',
        'translate',
        'email',
        1,
      );
      expect(metrics.recordPiiRedactions).toHaveBeenCalledWith(
        'deepl',
        'translate',
        'phone',
        1,
      );
      expect(debug).toHaveBeenCalledWith(
        'pii_scrubbed provider=deepl operation=translate outcome=redacted redactions=2 categories=email:1,phone:1',
      );
      for (const spy of [debug, warn]) {
        expect(JSON.stringify(spy.mock.calls)).not.toContain('john');
        expect(JSON.stringify(spy.mock.calls)).not.toContain('7700');
      }
    });
  });
});
