import { createHash } from 'node:crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { TranslateUiDto } from './dto/translate-ui.dto';
import { TranslateUiResult } from './interfaces/nlp-results.interface';

type TranslationProvider = 'deepl' | 'azure';

/** Prefix for content-addressed translations: `<prefix>:<language>:<sha256(source)>`. */
export const UI_TRANSLATION_CACHE_PREFIX = 'ui_i18n:v2';
/** Cached entries are immutable for a given source string, so expiry only bounds storage. */
export const UI_TRANSLATION_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
/** Provider characters one user may trigger per UTC day on cache misses. */
export const UI_TRANSLATION_DAILY_CHARACTER_BUDGET = 300_000;

const BUDGET_KEY_PREFIX = 'ui_i18n:budget';
const BUDGET_KEY_TTL_SECONDS = 2 * 24 * 60 * 60;
const PROVIDER_TIMEOUT_MS = 10_000;
const PROVIDER_CONCURRENCY = 3;
const MAX_TRANSLATION_LENGTH = 4000;

/** DeepL documents 50 texts and 128 KiB per request, so keep headroom below both. */
const CHUNK_MAX_TEXTS = 50;
const CHUNK_MAX_BODY_BYTES = 96 * 1024;
/** Azure documents 50,000 characters per request. */
const CHUNK_MAX_CHARACTERS = 20_000;
/** Allowance for the markup that protects one placeholder (Azure is the longer form). */
const PLACEHOLDER_MARKUP_OVERHEAD = 40;

const PLACEHOLDER_PATTERN = /\{\{[^{}]*\}\}/g;
const LETTER_PATTERN = /\p{L}/u;
const ENTITY_PATTERN = /&(?:amp|lt|gt|quot|apos|#39);/g;
const ENTITY_TEXT: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
};
const TRADITIONAL_CHINESE_REGIONS = new Set(['TW', 'HK', 'MO']);

class ProviderRequestError extends Error {
  constructor(
    readonly provider: TranslationProvider,
    readonly reason: string,
  ) {
    super(`${provider}:${reason}`);
    this.name = 'ProviderRequestError';
  }
}

interface ProviderState {
  deepLDisabled: boolean;
}

interface MissingTranslationOutcome {
  translated: Map<string, string>;
  sourceFallbacks: number;
}

/**
 * Translates the English interface dictionary into another language.
 *
 * The caller supplies the English strings, so this service is deliberately not a
 * dictionary store. It is built so that untrusted input cannot damage other users
 * or run up provider cost:
 *
 * - Translations are cached per source string (`language` + SHA-256 of the text).
 *   A cache value can therefore only ever be the translation of the exact text it
 *   is addressed by, so one user can never poison the strings another user
 *   receives, and a changed English string is translated afresh automatically.
 * - Provider requests are chunked inside DeepL (50 texts, 128 KiB) and Azure limits.
 * - Placeholders such as `{{coins}}` are protected from the provider and every
 *   translation is checked to contain exactly the placeholders of its source.
 *   A string that fails the check stays in English and is never cached.
 * - Progress is persisted chunk by chunk, so a retry after a provider failure only
 *   translates what is still missing.
 * - Cache misses are charged against a per-user daily character budget.
 */
@Injectable()
export class UiDictionaryTranslationService {
  private readonly logger = new Logger(UiDictionaryTranslationService.name);
  private readonly languageLocks = new Map<string, Promise<void>>();

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async translate(
    userId: string,
    dto: TranslateUiDto,
  ): Promise<TranslateUiResult> {
    const requestedLanguage = dto.target_language.trim();
    const locale = this.parseLocale(requestedLanguage);
    if (locale.language === 'en') {
      return {
        target_language: requestedLanguage,
        translations: { ...dto.dictionary },
        cached: true,
      };
    }

    const startedAt = Date.now();
    const language = locale.toString().toLowerCase();
    const entries = Object.entries(dto.dictionary);
    const sources = [
      ...new Set(
        entries
          .map(([, text]) => text)
          .filter((text) => this.hasTranslatableText(text)),
      ),
    ];

    const resolved = await this.readCache(language, sources);
    let missing = sources.filter((source) => !resolved.has(source));
    const initialMisses = missing.length;
    let sourceFallbacks = 0;
    let providerCalled = false;

    if (missing.length > 0) {
      await this.withLanguageLock(language, async () => {
        // Another request for this language may have finished while we waited.
        const refreshed = await this.readCache(language, missing);
        for (const [source, translation] of refreshed) {
          resolved.set(source, translation);
        }
        missing = missing.filter((source) => !resolved.has(source));
        if (missing.length === 0) return;

        providerCalled = true;
        const outcome = await this.translateMissing(
          userId,
          locale,
          language,
          missing,
        );
        sourceFallbacks = outcome.sourceFallbacks;
        for (const [source, translation] of outcome.translated) {
          resolved.set(source, translation);
        }
      });
    }

    const translations: Record<string, string> = {};
    for (const [key, text] of entries) {
      translations[key] = resolved.get(text) ?? text;
    }

    this.logger.log(
      `ui_translation_completed language=${language} entries=${entries.length} ` +
        `uniqueStrings=${sources.length} cacheMisses=${initialMisses} ` +
        `sourceFallbacks=${sourceFallbacks} durationMs=${Date.now() - startedAt}`,
    );

    return {
      target_language: requestedLanguage,
      translations,
      cached: !providerCalled,
    };
  }

  private parseLocale(tag: string): Intl.Locale {
    try {
      return new Intl.Locale(tag);
    } catch {
      throw new BadRequestException('Unsupported interface language');
    }
  }

  /** Serialises provider work per language inside this process to avoid duplicate spend. */
  private async withLanguageLock<T>(
    language: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const previous = this.languageLocks.get(language) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    this.languageLocks.set(language, tail);

    await previous;
    try {
      return await task();
    } finally {
      release();
      if (this.languageLocks.get(language) === tail) {
        this.languageLocks.delete(language);
      }
    }
  }

  private cacheKey(language: string, source: string): string {
    const digest = createHash('sha256').update(source, 'utf8').digest('hex');
    return `${UI_TRANSLATION_CACHE_PREFIX}:${language}:${digest}`;
  }

  /** Reads validated cache hits. A cache outage degrades to "everything missing". */
  private async readCache(
    language: string,
    sources: string[],
  ): Promise<Map<string, string>> {
    const hits = new Map<string, string>();
    if (sources.length === 0) return hits;

    try {
      const redis = this.supabaseService.getRedisClient();
      const values = await redis.mget(
        ...sources.map((source) => this.cacheKey(language, source)),
      );
      sources.forEach((source, index) => {
        const cached = values[index];
        if (
          typeof cached === 'string' &&
          this.isValidTranslation(source, cached)
        ) {
          hits.set(source, cached);
        }
      });
    } catch (error: unknown) {
      this.logger.warn(
        `ui_translation_cache_unavailable operation=read language=${language} reason=${this.errorName(error)}`,
      );
    }
    return hits;
  }

  private async writeCache(
    language: string,
    translations: Map<string, string>,
  ): Promise<void> {
    if (translations.size === 0) return;

    try {
      const redis = this.supabaseService.getRedisClient();
      const pipeline = redis.pipeline();
      for (const [source, translation] of translations) {
        pipeline.set(
          this.cacheKey(language, source),
          translation,
          'EX',
          UI_TRANSLATION_CACHE_TTL_SECONDS,
        );
      }
      await pipeline.exec();
    } catch (error: unknown) {
      this.logger.warn(
        `ui_translation_cache_unavailable operation=write language=${language} reason=${this.errorName(error)}`,
      );
    }
  }

  private async translateMissing(
    userId: string,
    locale: Intl.Locale,
    language: string,
    sources: string[],
  ): Promise<MissingTranslationOutcome> {
    const deepLConfigured = Boolean(this.deepLKey());
    const azureConfigured = Boolean(this.azureKey());
    if (!deepLConfigured && !azureConfigured) {
      this.logger.error(
        `ui_translation_unconfigured language=${language} detail=no-translation-provider-configured`,
      );
      throw new ServiceUnavailableException(
        'Interface translation is temporarily unavailable',
      );
    }

    const requestedCharacters = sources.reduce(
      (total, source) => total + source.length,
      0,
    );
    await this.reserveBudget(userId, requestedCharacters);

    const translated = new Map<string, string>();
    const state: ProviderState = { deepLDisabled: false };
    const queue = this.buildChunks(sources);
    let failedChunks = 0;
    let sourceFallbacks = 0;
    let settledCharacters = 0;

    const worker = async (): Promise<void> => {
      for (let chunk = queue.shift(); chunk; chunk = queue.shift()) {
        try {
          const outputs = await this.translateChunk(chunk, locale, state);
          const accepted = new Map<string, string>();
          chunk.forEach((source, index) => {
            const output = outputs[index];
            if (this.isValidTranslation(source, output)) {
              accepted.set(source, output);
            } else {
              sourceFallbacks += 1;
            }
          });
          // Persist progress immediately so a retry resumes where this stopped.
          await this.writeCache(language, accepted);
          for (const [source, translation] of accepted) {
            translated.set(source, translation);
          }
          settledCharacters += chunk.reduce(
            (total, source) => total + source.length,
            0,
          );
        } catch (error: unknown) {
          failedChunks += 1;
          this.logProviderFailure(error, language, chunk.length);
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(PROVIDER_CONCURRENCY, queue.length) }, () =>
        worker(),
      ),
    );

    await this.refundBudget(userId, requestedCharacters - settledCharacters);

    if (failedChunks > 0) {
      this.logger.warn(
        `ui_translation_incomplete language=${language} failedChunks=${failedChunks} ` +
          `translated=${translated.size} requested=${sources.length}`,
      );
      throw new ServiceUnavailableException(
        'Interface translation is temporarily unavailable',
      );
    }

    return { translated, sourceFallbacks };
  }

  /** Splits sources into chunks that respect every provider request limit. */
  private buildChunks(sources: string[]): string[][] {
    const chunks: string[][] = [];
    let current: string[] = [];
    let currentBytes = 0;
    let currentCharacters = 0;

    for (const source of sources) {
      const markup = this.escapeMarkup(source);
      const placeholders = source.match(PLACEHOLDER_PATTERN)?.length ?? 0;
      const characters =
        markup.length + placeholders * PLACEHOLDER_MARKUP_OVERHEAD;
      const bytes =
        Buffer.byteLength(markup, 'utf8') +
        placeholders * PLACEHOLDER_MARKUP_OVERHEAD;

      const wouldOverflow =
        current.length >= CHUNK_MAX_TEXTS ||
        currentBytes + bytes > CHUNK_MAX_BODY_BYTES ||
        currentCharacters + characters > CHUNK_MAX_CHARACTERS;
      if (current.length > 0 && wouldOverflow) {
        chunks.push(current);
        current = [];
        currentBytes = 0;
        currentCharacters = 0;
      }
      current.push(source);
      currentBytes += bytes;
      currentCharacters += characters;
    }
    if (current.length > 0) chunks.push(current);
    return chunks;
  }

  private async translateChunk(
    chunk: string[],
    locale: Intl.Locale,
    state: ProviderState,
  ): Promise<string[]> {
    const azureConfigured = Boolean(this.azureKey());

    if (this.deepLKey() && !state.deepLDisabled) {
      try {
        return await this.translateWithDeepL(chunk, locale);
      } catch (error: unknown) {
        if (!azureConfigured) throw error;
        // Unsupported language or a provider outage: do not retry DeepL for the
        // remaining chunks of this request.
        state.deepLDisabled = true;
        this.logProviderFailure(error, locale.toString(), chunk.length);
      }
    }

    if (azureConfigured) {
      return this.translateWithAzure(chunk, locale);
    }
    throw new ProviderRequestError('deepl', 'unavailable');
  }

  private async translateWithDeepL(
    chunk: string[],
    locale: Intl.Locale,
  ): Promise<string[]> {
    const apiKey = this.deepLKey();
    const host = apiKey.endsWith(':fx')
      ? 'https://api-free.deepl.com'
      : 'https://api.deepl.com';

    const payload = await this.postJson('deepl', `${host}/v2/translate`, {
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: chunk.map((source) =>
          this.escapeMarkup(source).replace(
            PLACEHOLDER_PATTERN,
            (placeholder) => `<x>${placeholder}</x>`,
          ),
        ),
        source_lang: 'EN',
        target_lang: this.deepLTargetLanguage(locale),
        tag_handling: 'xml',
        ignore_tags: ['x'],
        preserve_formatting: true,
      }),
    });

    const translations = this.isRecord(payload) ? payload.translations : null;
    if (!Array.isArray(translations) || translations.length !== chunk.length) {
      throw new ProviderRequestError('deepl', 'invalid-response');
    }
    return translations.map((entry: unknown) => {
      if (!this.isRecord(entry) || typeof entry.text !== 'string') {
        throw new ProviderRequestError('deepl', 'invalid-response');
      }
      return this.decodeEntities(entry.text.replace(/<\/?x>/gi, ''));
    });
  }

  private async translateWithAzure(
    chunk: string[],
    locale: Intl.Locale,
  ): Promise<string[]> {
    const apiKey = this.azureKey();
    const query = new URLSearchParams({
      'api-version': '3.0',
      from: 'en',
      to: this.azureTargetLanguage(locale),
      textType: 'html',
    });
    const headers: Record<string, string> = {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/json',
    };
    const region = this.configService.get<string>('AZURE_TRANSLATOR_REGION');
    if (region && region.toLowerCase() !== 'global') {
      headers['Ocp-Apim-Subscription-Region'] = region;
    }

    const payload = await this.postJson(
      'azure',
      `https://api.cognitive.microsofttranslator.com/translate?${query.toString()}`,
      {
        headers,
        body: JSON.stringify(
          chunk.map((source) => ({
            Text: this.escapeMarkup(source).replace(
              PLACEHOLDER_PATTERN,
              (placeholder) =>
                `<span class="notranslate">${placeholder}</span>`,
            ),
          })),
        ),
      },
    );

    if (!Array.isArray(payload) || payload.length !== chunk.length) {
      throw new ProviderRequestError('azure', 'invalid-response');
    }
    return payload.map((entry: unknown) => {
      const first: unknown =
        this.isRecord(entry) && Array.isArray(entry.translations)
          ? entry.translations[0]
          : null;
      if (!this.isRecord(first) || typeof first.text !== 'string') {
        throw new ProviderRequestError('azure', 'invalid-response');
      }
      return this.decodeEntities(
        first.text.replace(/<\/?span(?:\s+class="notranslate")?\s*>/gi, ''),
      );
    });
  }

  private async postJson(
    provider: TranslationProvider,
    url: string,
    init: { headers: Record<string, string>; body: string },
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: init.headers,
        body: init.body,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new ProviderRequestError(provider, String(response.status));
      }
      return (await response.json()) as unknown;
    } catch (error: unknown) {
      if (error instanceof ProviderRequestError) throw error;
      throw new ProviderRequestError(
        provider,
        error instanceof Error && error.name === 'AbortError'
          ? 'timeout'
          : 'network',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Reserves provider characters for today, or rejects when the user is over budget. */
  private async reserveBudget(
    userId: string,
    characters: number,
  ): Promise<void> {
    let used: number;
    const key = this.budgetKey(userId);
    try {
      const redis = this.supabaseService.getRedisClient();
      used = await redis.incrby(key, characters);
      await redis.expire(key, BUDGET_KEY_TTL_SECONDS);
    } catch (error: unknown) {
      // Match NlpRateLimiterGuard: an unavailable counter must not block translation.
      this.logger.error(
        `ui_translation_budget_unavailable reason=${this.errorName(error)}`,
      );
      return;
    }

    if (used > UI_TRANSLATION_DAILY_CHARACTER_BUDGET) {
      await this.refundBudget(userId, characters);
      this.logger.warn(
        `ui_translation_budget_exceeded requested=${characters} budget=${UI_TRANSLATION_DAILY_CHARACTER_BUDGET}`,
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            'Interface translation quota reached for today. Please try again tomorrow.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async refundBudget(
    userId: string,
    characters: number,
  ): Promise<void> {
    if (characters <= 0) return;
    try {
      await this.supabaseService
        .getRedisClient()
        .decrby(this.budgetKey(userId), characters);
    } catch (error: unknown) {
      this.logger.warn(
        `ui_translation_budget_unavailable operation=refund reason=${this.errorName(error)}`,
      );
    }
  }

  private budgetKey(userId: string): string {
    const day = new Date().toISOString().slice(0, 10);
    return `${BUDGET_KEY_PREFIX}:${userId}:${day}`;
  }

  /**
   * A translation is only accepted when it contains exactly the placeholders of
   * its source and introduces no markup that the source did not have.
   */
  private isValidTranslation(source: string, translation: string): boolean {
    if (
      typeof translation !== 'string' ||
      translation.trim().length === 0 ||
      translation.length > MAX_TRANSLATION_LENGTH
    ) {
      return false;
    }
    if (!source.includes('<') && translation.includes('<')) return false;

    const expected = (source.match(PLACEHOLDER_PATTERN) ?? []).sort();
    const actual = (translation.match(PLACEHOLDER_PATTERN) ?? []).sort();
    return (
      expected.length === actual.length &&
      expected.every((placeholder, index) => placeholder === actual[index])
    );
  }

  /** Placeholders alone, numbers, symbols and emoji have nothing to translate. */
  private hasTranslatableText(text: string): boolean {
    return LETTER_PATTERN.test(text.replace(PLACEHOLDER_PATTERN, ''));
  }

  private escapeMarkup(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /** Single pass, so `&amp;lt;` decodes to `&lt;` and never to `<`. */
  private decodeEntities(text: string): string {
    return text.replace(
      ENTITY_PATTERN,
      (entity) => ENTITY_TEXT[entity] ?? entity,
    );
  }

  private deepLTargetLanguage(locale: Intl.Locale): string {
    switch (locale.language) {
      case 'zh':
        return locale.script === 'Hant' ||
          TRADITIONAL_CHINESE_REGIONS.has(locale.region ?? '')
          ? 'ZH-HANT'
          : 'ZH-HANS';
      case 'pt':
        return locale.region === 'PT' ? 'PT-PT' : 'PT-BR';
      case 'no':
        return 'NB';
      default:
        return locale.language.toUpperCase();
    }
  }

  private azureTargetLanguage(locale: Intl.Locale): string {
    switch (locale.language) {
      case 'zh':
        return locale.script === 'Hant' ||
          TRADITIONAL_CHINESE_REGIONS.has(locale.region ?? '')
          ? 'zh-Hant'
          : 'zh-Hans';
      case 'pt':
        return locale.region === 'PT' ? 'pt-pt' : 'pt';
      case 'no':
        return 'nb';
      default:
        return locale.language;
    }
  }

  private deepLKey(): string {
    return this.configService.get<string>('DEEPL_API_KEY') ?? '';
  }

  private azureKey(): string {
    return this.configService.get<string>('AZURE_TRANSLATOR_KEY') ?? '';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private errorName(error: unknown): string {
    return error instanceof Error ? error.name : 'unknown';
  }

  /** Logs only the provider, a status or failure class and counts, never text. */
  private logProviderFailure(
    error: unknown,
    language: string,
    chunkSize: number,
  ): void {
    const provider =
      error instanceof ProviderRequestError ? error.provider : 'unknown';
    const reason =
      error instanceof ProviderRequestError
        ? error.reason
        : this.errorName(error);
    this.logger.warn(
      `ui_translation_provider_failure provider=${provider} reason=${reason} ` +
        `language=${language} chunkSize=${chunkSize}`,
    );
  }
}
