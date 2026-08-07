import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import Redis from 'ioredis';

@Injectable()
export class CentrifugoService implements OnModuleInit {
  private apiUrl!: string;
  private apiKey!: string;
  private tokenSecret!: string;
  private connectionRateLimitPerSec: number;
  private clientConnectionRateWindowSec: number;
  private redis: Redis | null = null;

  constructor(private readonly configService: ConfigService) {
    this.connectionRateLimitPerSec = this.parseLimit(
      this.configService.get<string>('CENTRIFUGO_CONNECTION_RATE_LIMIT'),
      5,
    );
    this.clientConnectionRateWindowSec = this.parseLimit(
      this.configService.get<string>('CENTRIFUGO_CONNECTION_RATE_WINDOW_SEC'),
      60,
    );
  }

  onModuleInit() {
    this.apiUrl = `${this.configService.get<string>('CENTRIFUGO_URL')}/api`;
    this.apiKey = this.configService.get<string>('CENTRIFUGO_API_KEY')!;
    this.tokenSecret = this.configService.get<string>('CENTRIFUGO_SECRET')!;

    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
      void this.redis.connect().catch(() => {
        this.redis?.disconnect();
        this.redis = null;
      });
    } catch {
      this.redis = null;
    }
  }

  /**
   * Checks whether a user is allowed to open a new WebSocket connection
   * based on the configured rate limit. Uses Redis sliding-window counting
   * to track connection attempts across all backend instances.
   *
   * Falls back to allowing the connection when Redis is unavailable.
   */
  async checkConnectionRateLimit(userId: string): Promise<boolean> {
    if (!this.redis) {
      return true; // allow when Redis is unavailable
    }

    const key = `centrifugo:conn_rate:${userId}`;
    const now = Date.now();
    const windowStart = now - this.clientConnectionRateWindowSec * 1000;

    try {
      const multi = this.redis.multi();
      multi.zremrangebyscore(key, 0, windowStart);
      multi.zcard(key);
      const results = await multi.exec();

      if (!results) {
        return true;
      }

      const [, countResult] = results;
      const count = (countResult?.[1] as number) ?? 0;

      if (count >= this.connectionRateLimitPerSec) {
        return false;
      }

      await this.redis.zadd(key, now.toString(), `${now}:${Math.random().toString(36).slice(2)}`);
      await this.redis.expire(key, this.clientConnectionRateWindowSec);
      return true;
    } catch {
      return true; // allow on Redis error
    }
  }

  private parseLimit(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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
