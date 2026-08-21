import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TranslateDto } from './dto/translate.dto';
import { TransliterateDto } from './dto/transliterate.dto';
import {
  TranslationResult,
  TransliterationResult,
} from './interfaces/nlp-results.interface';
import { NlpService } from './nlp.service';

interface TranslationProviderResult {
  translatedText: string;
  detectedLanguage?: string;
}

interface ScriptPair {
  fromScript: string;
  toScript: string;
}

const DEFAULT_TRANSLITERATION_SCRIPTS: Record<string, ScriptPair> = {
  ar: { fromScript: 'Arab', toScript: 'Latn' },
  fa: { fromScript: 'Arab', toScript: 'Latn' },
  he: { fromScript: 'Hebr', toScript: 'Latn' },
  hi: { fromScript: 'Deva', toScript: 'Latn' },
  ja: { fromScript: 'Jpan', toScript: 'Latn' },
  ru: { fromScript: 'Cyrl', toScript: 'Latn' },
  th: { fromScript: 'Thai', toScript: 'Latn' },
  uk: { fromScript: 'Cyrl', toScript: 'Latn' },
};

@Injectable()
export class TranslationRouterService {
  private readonly logger = new Logger(TranslationRouterService.name);
  private static readonly PROVIDER_TIMEOUT_MS = 10_000;
  private static readonly AZURE_TRANSLATOR_BASE_URL =
    'https://api.cognitive.microsofttranslator.com';

  constructor(
    private readonly configService: ConfigService,
    private readonly nlpService: NlpService,
  ) {}

  async translate(
    userId: string,
    isVip: boolean,
    dto: TranslateDto,
  ): Promise<TranslationResult> {
    await this.nlpService.checkRateLimit(userId, isVip);

    const originalText = dto.text.trim();
    const detectedLanguage = (
      dto.source_language || this.nlpService.detectLanguage(originalText).language
    ).toLowerCase();

    const deepLResult = await this.tryDeepLTranslation(
      originalText,
      detectedLanguage,
      dto.target_language,
    );
    const providerResult =
      deepLResult ??
      (await this.tryAzureTranslation(
        originalText,
        detectedLanguage,
        dto.target_language,
      ));

    if (!providerResult) {
      throw new ServiceUnavailableException(
        'Translation service is temporarily unavailable',
      );
    }

    const transliteration = await this.tryAutomaticTransliteration(
      providerResult.translatedText,
      dto.target_language,
    );

    return {
      original_text: originalText,
      translated_text: providerResult.translatedText,
      detected_language:
        providerResult.detectedLanguage?.toLowerCase() ?? detectedLanguage,
      transliteration,
      definition: `Translation of "${originalText}" in ${dto.target_language}`,
      pronunciation_url: this.buildPronunciationUrl(
        providerResult.translatedText,
        dto.target_language,
      ),
    };
  }

  async transliterate(
    userId: string,
    isVip: boolean,
    dto: TransliterateDto,
  ): Promise<TransliterationResult> {
    await this.nlpService.checkRateLimit(userId, isVip);

    const originalText = dto.text.trim();
    const result = await this.tryAzureTransliteration(
      originalText,
      dto.language,
      this.normaliseScript(dto.from_script),
      this.normaliseScript(dto.to_script),
      true,
    );

    if (!result) {
      throw new ServiceUnavailableException(
        'Transliteration service is temporarily unavailable',
      );
    }

    return {
      original_text: originalText,
      transliterated_text: result,
      language: dto.language.toLowerCase(),
      from_script: this.normaliseScript(dto.from_script),
      to_script: this.normaliseScript(dto.to_script),
    };
  }

  private async tryDeepLTranslation(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<TranslationProviderResult | null> {
    const apiKey = this.configService.get<string>('DEEPL_API_KEY');
    if (!apiKey) return null;

    const host = apiKey.endsWith(':fx')
      ? 'https://api-free.deepl.com'
      : 'https://api.deepl.com';

    try {
      const response = await this.fetchProvider(`${host}/v2/translate`, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: [text],
          target_lang: targetLanguage.toUpperCase(),
          source_lang: sourceLanguage.toUpperCase(),
          preserve_formatting: true,
        }),
      });

      if (!response.ok) {
        this.logProviderFailure('deepl', 'translate', response.status);
        return null;
      }

      const payload: unknown = await response.json();
      const translation = this.readDeepLTranslation(payload);
      if (!translation) {
        this.logProviderFailure('deepl', 'translate', 'invalid-response');
      }
      return translation;
    } catch (error: unknown) {
      this.logProviderException('deepl', 'translate', error);
      return null;
    }
  }

  private async tryAzureTranslation(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<TranslationProviderResult | null> {
    const apiKey = this.configService.get<string>('AZURE_TRANSLATOR_KEY');
    if (!apiKey) return null;

    const query = new URLSearchParams({
      'api-version': '3.0',
      from: sourceLanguage,
      to: targetLanguage,
    });

    try {
      const response = await this.fetchProvider(
        `${TranslationRouterService.AZURE_TRANSLATOR_BASE_URL}/translate?${query.toString()}`,
        {
          method: 'POST',
          headers: this.azureHeaders(apiKey),
          body: JSON.stringify([{ Text: text }]),
        },
      );

      if (!response.ok) {
        this.logProviderFailure('azure', 'translate', response.status);
        return null;
      }

      const payload: unknown = await response.json();
      const translation = this.readAzureTranslation(payload);
      if (!translation) {
        this.logProviderFailure('azure', 'translate', 'invalid-response');
      }
      return translation;
    } catch (error: unknown) {
      this.logProviderException('azure', 'translate', error);
      return null;
    }
  }

  private async tryAutomaticTransliteration(
    text: string,
    targetLanguage: string,
  ): Promise<string | undefined> {
    if (this.isLatinText(text)) return text;

    const language = targetLanguage.toLowerCase().split('-')[0];
    const scriptPair = DEFAULT_TRANSLITERATION_SCRIPTS[language];
    if (!scriptPair) return undefined;

    return (
      (await this.tryAzureTransliteration(
        text,
        language,
        scriptPair.fromScript,
        scriptPair.toScript,
        false,
      )) ?? undefined
    );
  }

  private async tryAzureTransliteration(
    text: string,
    language: string,
    fromScript: string,
    toScript: string,
    rejectUnsupportedPair: boolean,
  ): Promise<string | null> {
    const apiKey = this.configService.get<string>('AZURE_TRANSLATOR_KEY');
    if (!apiKey) return null;

    const query = new URLSearchParams({
      'api-version': '3.0',
      language: language.toLowerCase(),
      fromScript,
      toScript,
    });

    try {
      const response = await this.fetchProvider(
        `${TranslationRouterService.AZURE_TRANSLATOR_BASE_URL}/transliterate?${query.toString()}`,
        {
          method: 'POST',
          headers: this.azureHeaders(apiKey),
          body: JSON.stringify([{ Text: text }]),
        },
      );

      if (!response.ok) {
        this.logProviderFailure('azure', 'transliterate', response.status);
        if (rejectUnsupportedPair && response.status === 400) {
          throw new BadRequestException(
            'Unsupported transliteration language or script pair',
          );
        }
        return null;
      }

      const payload: unknown = await response.json();
      const transliteratedText = this.readAzureTransliteration(payload);
      if (!transliteratedText) {
        this.logProviderFailure(
          'azure',
          'transliterate',
          'invalid-response',
        );
      }
      return transliteratedText;
    } catch (error: unknown) {
      if (error instanceof BadRequestException) throw error;
      this.logProviderException('azure', 'transliterate', error);
      return null;
    }
  }

  private async fetchProvider(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      TranslationRouterService.PROVIDER_TIMEOUT_MS,
    );

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private azureHeaders(apiKey: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/json',
    };
    const region = this.configService.get<string>('AZURE_TRANSLATOR_REGION');
    if (region && region.toLowerCase() !== 'global') {
      headers['Ocp-Apim-Subscription-Region'] = region;
    }
    return headers;
  }

  private readDeepLTranslation(
    payload: unknown,
  ): TranslationProviderResult | null {
    if (!this.isRecord(payload) || !Array.isArray(payload.translations)) {
      return null;
    }
    const first = payload.translations[0];
    if (!this.isRecord(first) || typeof first.text !== 'string') return null;
    const translatedText = first.text.trim();
    if (!translatedText) return null;

    return {
      translatedText,
      detectedLanguage:
        typeof first.detected_source_language === 'string'
          ? first.detected_source_language
          : undefined,
    };
  }

  private readAzureTranslation(
    payload: unknown,
  ): TranslationProviderResult | null {
    if (!Array.isArray(payload) || payload.length === 0) return null;
    const first = payload[0];
    if (!this.isRecord(first) || !Array.isArray(first.translations)) {
      return null;
    }
    const firstTranslation = first.translations[0];
    if (
      !this.isRecord(firstTranslation) ||
      typeof firstTranslation.text !== 'string'
    ) {
      return null;
    }
    const translatedText = firstTranslation.text.trim();
    if (!translatedText) return null;

    let detectedLanguage: string | undefined;
    if (
      this.isRecord(first.detectedLanguage) &&
      typeof first.detectedLanguage.language === 'string'
    ) {
      detectedLanguage = first.detectedLanguage.language;
    }

    return { translatedText, detectedLanguage };
  }

  private readAzureTransliteration(payload: unknown): string | null {
    if (!Array.isArray(payload) || payload.length === 0) return null;
    const first = payload[0];
    if (!this.isRecord(first) || typeof first.text !== 'string') return null;
    const text = first.text.trim();
    return text || null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isLatinText(text: string): boolean {
    return !/[^\p{Script=Latin}\p{Number}\p{Punctuation}\p{Separator}\p{Mark}]/u.test(
      text,
    );
  }

  private normaliseScript(script: string): string {
    const lower = script.toLowerCase();
    return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
  }

  private buildPronunciationUrl(text: string, language: string): string {
    return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(text)}&tl=${encodeURIComponent(language)}`;
  }

  private logProviderFailure(
    provider: 'azure' | 'deepl',
    operation: 'translate' | 'transliterate',
    status: number | string,
  ): void {
    this.logger.warn(
      `nlp_provider_failure provider=${provider} operation=${operation} status=${status}`,
    );
  }

  private logProviderException(
    provider: 'azure' | 'deepl',
    operation: 'translate' | 'transliterate',
    error: unknown,
  ): void {
    const reason = error instanceof Error ? error.name : 'unknown';
    this.logger.warn(
      `nlp_provider_exception provider=${provider} operation=${operation} reason=${reason}`,
    );
  }
}
