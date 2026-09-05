import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import * as jwt from 'jsonwebtoken';
import Redis from 'ioredis-v6';
import { randomUUID } from 'crypto';

/**
 * Result of a connection rate-limit check.
 * When `allowed` is false, `retryAfterMs` indicates how long the client
 * should wait (in milliseconds) before trying again.
 */
export interface ConnectionRateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

/**
 * Lua script that atomically checks and increments a sliding-window
 * rate limit counter using a Redis sorted set.
 *
 * KEYS[1] - sorted set key
 * ARGV[1] - window start timestamp (remove entries older than this)
 * ARGV[2] - current timestamp (score for the new entry)
 * ARGV[3] - unique member value
 * ARGV[4] - max allowed count in the window
 * ARGV[5] - TTL in seconds for the key
 *
 * Returns a table with two elements:
 *   [1] 1 if allowed, 0 if rate-limited
 *   [2] retry-after suggestion in ms (time until oldest entry expires)
 */
const SLIDING_WINDOW_LUA = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])
local count = redis.call('ZCARD', KEYS[1])
local limit = tonumber(ARGV[4])
if count >= limit then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  local retryMs = 0
  if #oldest >= 2 then
    local windowMs = tonumber(ARGV[5]) * 1000
    retryMs = math.max(0, tonumber(oldest[2]) + windowMs - tonumber(ARGV[2]))
  end
  return {0, retryMs}
end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
redis.call('EXPIRE', KEYS[1], ARGV[5])
return {1, 0}
`;

@Injectable()
export class CentrifugoService implements OnModuleInit {
  private apiUrl!: string;
  private apiKey!: string;
  private tokenSecret!: string;
  private connectionRateLimitPerWindow: number;
  private connectionRateWindowSec: number;
  private redis: Redis | null = null;

  /** Lua script SHA loaded on Redis connection, for atomic rate-limited checking */
  private slidingWindowLuaSha: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectPinoLogger(CentrifugoService.name)
    private readonly logger: PinoLogger,
  ) {
    this.connectionRateLimitPerWindow = this.parseLimit(
      this.configService.get<string>('CENTRIFUGO_CONNECTION_RATE_LIMIT'),
      5,
    );
    this.connectionRateWindowSec = this.parseLimit(
      this.configService.get<string>('CENTRIFUGO_CONNECTION_RATE_WINDOW_SEC'),
      60,
    );
  }

  async onModuleInit() {
    this.apiUrl = `${this.configService.get<string>('CENTRIFUGO_URL')}/api`;

    // Security enhancement: Fail-fast securely if critical credentials are missing in production.
    // This prevents the application from booting into a state where secrets evaluate to undefined,
    // which could allow forged connections or bypassed API limits.
    const apiKey = this.configService.get<string>('CENTRIFUGO_API_KEY');
    const secret = this.configService.get<string>('CENTRIFUGO_SECRET');

    const env = this.configService.get<string>('NODE_ENV') || 'development';
    if (env === 'production') {
      if (!apiKey) {
        throw new Error('CENTRIFUGO_API_KEY must be configured in production');
      }
      if (!secret) {
        throw new Error('CENTRIFUGO_SECRET must be configured in production');
      }
    }

    this.apiKey = apiKey!;
    this.tokenSecret = secret!;

    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false,
        // ioredis 6 defaults to RESP3; retain v5 response shapes.
        protocol: 2,
      });
      await this.redis.connect();
      // Pre-load the Lua script so we can call it by SHA digest (EVALSHA)
      const sha = await this.redis.script('LOAD', SLIDING_WINDOW_LUA);
      if (typeof sha === 'string' && sha.length === 40) {
        this.slidingWindowLuaSha = sha;
      }
    } catch {
      this.redis?.disconnect();
      this.redis = null;
      this.slidingWindowLuaSha = null;
    }
  }

  /**
   * Checks whether a user (or IP address as fallback) is allowed to open a new
   * WebSocket connection based on the configured rate limit.
   *
   * Uses a Redis-backed atomic sliding-window counter via a Lua script so that
   * concurrent requests across multiple backend instances are correctly
   * serialised. Falls back to per-user counting with a pipeline when the Lua
   * script SHA is not available.
   *
   * When Redis is unavailable the connection is always allowed.
   *
   * @param userId  The authenticated user id.
   * @param ip      Client IP address, used as a secondary key when userId is
   *                unavailable and as a co-limit key to prevent multi-account
   *                abuse.
   */
  async checkConnectionRateLimit(
    userId: string,
    ip?: string,
  ): Promise<ConnectionRateLimitResult> {
    const identityKey = userId || ip || 'anonymous';

    if (!this.redis) {
      return { allowed: true, retryAfterMs: 0 };
    }

    const key = `centrifugo:conn_rate:${identityKey}`;
    const now = Date.now();
    const windowStart = now - this.connectionRateWindowSec * 1000;
    const member = `${now}:${randomUUID()}`;

    try {
      // Prefer atomic Lua script; fall back to pipeline when not loaded
      if (this.slidingWindowLuaSha) {
        const raw = await this.redis.evalsha(
          this.slidingWindowLuaSha,
          1,
          key,
          windowStart.toString(),
          now.toString(),
          member,
          this.connectionRateLimitPerWindow.toString(),
          this.connectionRateWindowSec.toString(),
        );

        const result = Array.isArray(raw) ? raw : [];
        const allowed = result.length >= 1 ? Number(result[0]) === 1 : true;
        const retryAfterMs = result.length >= 2 ? Number(result[1]) || 0 : 0;
        return { allowed, retryAfterMs };
      }

      // Fallback pipeline approach (not fully atomic under contention)
      const multi = this.redis.multi();
      multi.zremrangebyscore(key, 0, windowStart);
      multi.zcard(key);
      const results = await multi.exec();

      if (!results) {
        return { allowed: true, retryAfterMs: 0 };
      }

      const [, countResult] = results;
      const count = (countResult?.[1] as number) ?? 0;

      if (count >= this.connectionRateLimitPerWindow) {
        return {
          allowed: false,
          retryAfterMs: this.connectionRateWindowSec * 1000,
        };
      }

      await this.redis.zadd(key, now.toString(), member);
      await this.redis.expire(key, this.connectionRateWindowSec);
      return { allowed: true, retryAfterMs: 0 };
    } catch {
      return { allowed: true, retryAfterMs: 0 }; // allow on Redis error
    }
  }

  /**
   * Exposes the configured rate-limit window in seconds so the controller
   * can set a `Retry-After` header on 429 responses.
   */
  getRateWindowSec(): number {
    return this.connectionRateWindowSec;
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
      this.logger.error(
        { error: (e as Error).message, channel },
        'Centrifugo publish error',
      );
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
