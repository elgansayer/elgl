import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { TranslationService } from './translation.service';

@Injectable()
export class CentrifugoService implements OnModuleInit {
  private apiUrl!: string;
  private apiKey!: string;
  private tokenSecret!: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly translationService: TranslationService,
  ) {}

  onModuleInit() {
    this.apiUrl = `${this.configService.get<string>('CENTRIFUGO_URL')}/api`;
    this.apiKey = this.configService.get<string>('CENTRIFUGO_API_KEY')!;
    this.tokenSecret = this.configService.get<string>('CENTRIFUGO_SECRET')!;
  }

  generateConnectionToken(userId: string): { token: string } {
    const payload = {
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    };
    const token = jwt.sign(payload, this.tokenSecret);
    return { token };
  }

  async publish(
    channel: string,
    data: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `apikey ${this.apiKey}`,
        },
        body: JSON.stringify({
          method: 'publish',
          params: {
            channel,
            data,
          },
        }),
      });
      return response.ok;
    } catch (e) {
      console.error('Centrifugo publish error:', e);
      return false;
    }
  }

  /**
   * Publishes a voice‑room chat message with real‑time translation.
   *
   * 1. Detects the source language of `textContent`.
   * 2. Translates the text into the target language.
   * 3. Publishes a payload that includes both the original and the
   *    translated version so that the client can display either.
   */
  async publishTranslated(
    channel: string,
    originalText: string,
    targetLang: string,
    extraData: Record<string, unknown>,
  ): Promise<boolean> {
    let detectedLanguage = 'en';
    let translatedText = originalText;

    try {
      const detected =
        await this.translationService.detectLanguage(originalText);
      detectedLanguage = detected;

      // Avoid translating when source and target are identical
      if (detectedLanguage !== targetLang) {
        translatedText = await this.translationService.translate(
          originalText,
          detectedLanguage,
          targetLang,
        );
      }
    } catch (error) {
      console.error(
        'Translation failed, falling back to original text:',
        error,
      );
    }

    const data: Record<string, unknown> = {
      ...extraData,
      text_content: originalText,
      original_text: originalText,
      translated_text: translatedText,
      detected_language: detectedLanguage,
    };

    return this.publish(channel, data);
  }
}
