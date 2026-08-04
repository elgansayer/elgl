import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class CentrifugoService implements OnModuleInit {
  private apiUrl!: string;
  private apiKey!: string;
  private tokenSecret!: string;

  constructor(private readonly configService: ConfigService) {}

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

  /**
   * Signs an arbitrary JWT payload using the Centrifugo token secret.
   */
  signJwt(payload: Record<string, unknown>): Promise<string> {
    return Promise.resolve(jwt.sign(payload, this.tokenSecret));
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
   * Publishes a voice‑room chat message.
   */
  async publishTranslated(
    channel: string,
    originalText: string,
    targetLang: string,
    extraData: Record<string, unknown>,
  ): Promise<boolean> {
    const data: Record<string, unknown> = {
      ...extraData,
      text_content: originalText,
      original_text: originalText,
      translated_text: originalText,
      detected_language: 'en',
    };

    return this.publish(channel, data);
  }
}
