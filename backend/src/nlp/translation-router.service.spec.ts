import type { Mock } from 'vitest';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
});
