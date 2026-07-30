import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TranslationService {
  private r2?: string;
  private deeplApiKey?: string;

  constructor(private configService: ConfigService) {
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

    const url = 'https://api-free.deepl.com/v2/languages';
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `DeepL-Auth-Key ${this.deeplApiKey}`,
        },
      });

      if (!response.ok) {
        console.warn('Language detection failed, falling back to en');
        return 'en';
      }

      const languages: { language: string; name: string }[] =
        await response.json();

      // For simplicity we only try to parse the text using NLP later,
      // but here we rely on DeepL's detect endpoint for accuracy.
      const detectUrl = 'https://api-free.deepl.com/v2/translate';
      const formData = new URLSearchParams();
      formData.append('text', text);
      formData.append('target_lang', 'EN'); // always temporary
      const detectRes = await fetch(detectUrl, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${this.deeplApiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!detectRes.ok) {
        return 'en';
      }

      const body = await detectRes.json();
      if (body && body.translations && body.translations.length > 0) {
        const detectedSource =
          body.translations[0].detected_source_language || 'en';
        return detectedSource.toLowerCase();
      }

      return 'en';
    } catch {
      console.warn('Language detection error, falling back to en');
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
        console.warn(`Translation API returned ${response.status}`);
        return text;
      }

      const body = await response.json();
      if (body && body.translations && body.translations.length > 0) {
        return body.translations[0].text;
      }

      return text;
    } catch {
      console.warn('Translation error, returning original text');
      return text;
    }
  }
}
