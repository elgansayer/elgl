import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

/**
 * Detailed translation result that includes the main translation,
 * alternative renditions, and a human‑readable context explanation.
 */
export interface TranslationExplanations {
  /** The primary translation. */
  translation: string;
  /** One or more alternative ways to express the same meaning. */
  alternatives: string[];
  /** An optional sentence or paragraph explaining the context. */
  contextExplanation?: string;
}

@Injectable()
export class TranslationService {
  private deeplApiKey?: string;
  private readonly translationCache = new Map<string, string>();
  private readonly detectionCache = new Map<string, string>();

  constructor(
    private configService: ConfigService,
    @InjectPinoLogger(TranslationService.name)
    private readonly logger: PinoLogger,
  ) {
    this.deeplApiKey = this.configService.get<string>('DEEPL_API_KEY');
  }

  /**
   * Detects the language of the given text.
   * Returns a 2‑letter ISO 639‑1 code (e.g., "en", "es", "ar").
   */
  async detectLanguage(text: string): Promise<string> {
    if (!this.deeplApiKey) {
      return 'en';
    }

    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return 'en';
    }

    const cacheKey = trimmed.toLowerCase();
    const cached = this.detectionCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const detectUrl = 'https://api-free.deepl.com/v2/translate';
    const formData = new URLSearchParams();
    formData.append('text', text);
    formData.append('target_lang', 'EN'); // always temporary

    try {
      const detectRes = await fetch(detectUrl, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${this.deeplApiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!detectRes.ok) {
        this.logger.warn(
          { status: detectRes.status, textLength: trimmed.length },
          'Language detection failed, falling back to en',
        );
        return 'en';
      }

      const body: unknown = await detectRes.json();
      const bodyRecord =
        body !== null && typeof body === 'object'
          ? (body as Record<string, unknown>)
          : null;
      const translations = bodyRecord?.['translations'];
      if (!Array.isArray(translations) || translations.length === 0) {
        return 'en';
      }

      const first = translations[0];
      if (first !== null && typeof first === 'object') {
        const record = first as Record<string, unknown>;
        const detected = record['detected_source_language'];
        if (typeof detected === 'string' && detected.length > 0) {
          const normalized = detected.toLowerCase();
          this.detectionCache.set(cacheKey, normalized);
          return normalized;
        }
      }

      return 'en';
    } catch (err) {
      this.logger.warn(
        { error: (err as Error).message, textLength: trimmed.length },
        'Language detection error, falling back to en',
      );
      return 'en';
    }
  }

  /**
   * Translates `text` from `sourceLang` to `targetLang`.
   * Both codes are ISO 639‑1 lowercase (e.g., "en", "es", "ar").
   */
  async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
  ): Promise<string> {
    if (!this.deeplApiKey) {
      return text;
    }

    const key = `${text}|${sourceLang.toUpperCase()}|${targetLang.toUpperCase()}`;
    const cached = this.translationCache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const url = 'https://api-free.deepl.com/v2/translate';
    const formData = new URLSearchParams();
    formData.append('text', text);
    formData.append('source_lang', sourceLang.toUpperCase());
    formData.append('target_lang', targetLang.toUpperCase());

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${this.deeplApiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        this.logger.warn(
          {
            status: response.status,
            sourceLang: sourceLang.toUpperCase(),
            targetLang: targetLang.toUpperCase(),
          },
          `Translation API returned ${response.status}`,
        );
        return text;
      }

      const body: unknown = await response.json();
      const bodyRecord =
        body !== null && typeof body === 'object'
          ? (body as Record<string, unknown>)
          : null;
      const translations = bodyRecord?.['translations'];
      if (Array.isArray(translations) && translations.length > 0) {
        const first = translations[0];
        if (first !== null && typeof first === 'object') {
          const record = first as Record<string, unknown>;
          const translation = record['text'];
          if (typeof translation === 'string' && translation.length > 0) {
            this.translationCache.set(key, translation);
            return translation;
          }
        }
      }

      this.translationCache.set(key, text);
      return text;
    } catch (err) {
      this.translationCache.set(key, text);
      this.logger.warn(
        {
          error: (err as Error).message,
          sourceLang: sourceLang.toUpperCase(),
          targetLang: targetLang.toUpperCase(),
        },
        'Translation error, returning original text',
      );
      return text;
    }
  }

  /**
   * Translates `text` to `targetLang` and returns both the translated result and the detected language.
   * Primarily used for the real‑time chat overlay in Voicerooms.
   */
  async translateWithDetection(
    text: string,
    targetLang: string,
  ): Promise<{ translatedText: string; detectedLanguage: string }> {
    const detected = await this.detectLanguage(text);
    const translated = await this.translate(text, detected, targetLang);
    return { translatedText: translated, detectedLanguage: detected };
  }

  /**
   * Translates the given text and returns a rich result containing the main
   * translation, alternative expressions, and a contextual explanation.
   *
   * This method is intended to be consumed by the UI when the
   * `showDetailedExplanations` preference is enabled.
   */
  async translateWithExplanations(
    text: string,
    sourceLang: string,
    targetLang: string,
  ): Promise<TranslationExplanations> {
    // Get the primary translation using the existing method.
    const primaryTranslation = await this.translate(
      text,
      sourceLang,
      targetLang,
    );

    // For alternative expressions, reuse the same API call but with a
    // different target language (e.g., the source language) to obtain
    // a reverse‑direction translation – this is a heuristic while we
    // wait for a proper synonyms endpoint.
    const reverseTranslation = await this.translate(
      primaryTranslation,
      targetLang,
      sourceLang,
    );

    // Build a static list of alternatives purely for demonstration.
    // In production this would be replaced by a call to DeepL's glossary
    // or Azure’s synonym API.
    const alternatives: string[] = [
      primaryTranslation,
      `(more formal) ${primaryTranslation}`,
      `(more colloquial) ${reverseTranslation || primaryTranslation}`,
    ];

    // Generate a simple context explanation based on the source text.
    const contextExplanation = `"${text}" is a phrase in ${sourceLang} that, in most everyday settings, corresponds to "${primaryTranslation}" in ${targetLang}. The choice of alternative depends on the register and exact nuance you wish to convey.`;

    return {
      translation: primaryTranslation,
      alternatives,
      contextExplanation,
    };
  }
}
