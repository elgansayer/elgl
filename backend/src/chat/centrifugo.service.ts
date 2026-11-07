import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import * as jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { MetricsService } from '../metrics/metrics.service';

const CONNECTION_TOKEN_TTL_SECONDS = 60 * 60;
const CONNECTION_TOKEN_SIGNING_ERROR =
  'Centrifugo connection token signing unavailable';

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
 * Closed set of reasons the limiter failed open. Safe to log and to alert on
 * because it never carries Redis hostnames, user ids or request data.
 */
type RateLimiterDegradedReason =
  'redis_unavailable' | 'redis_error' | 'malformed_reply';

/**
 * Reduces an unknown Redis failure to its class name and optional error code
 * (for example `ECONNREFUSED`). The message is deliberately dropped because
 * driver messages can embed connection details.
 */
function describeRedisFailure(error: unknown): {
  errorName: string;
  errorCode?: string;
} {
  if (!(error instanceof Error)) {
    return { errorName: 'UnknownError' };
  }
  if ('code' in error && typeof error.code === 'string') {
    return { errorName: error.name, errorCode: error.code };
  }
  return { errorName: error.name };
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
    private readonly metrics: MetricsService,
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
      if (!apiKey || apiKey === 'test-centrifugo-api-key') {
        throw new Error(
          'CENTRIFUGO_API_KEY must be securely configured in production',
        );
      }
      if (!secret || secret === 'test-centrifugo-secret') {
        throw new Error(
          'CENTRIFUGO_SECRET must be securely configured in production',
        );
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
      });
      await this.redis.connect();
      // Pre-load the Lua script so we can call it by SHA digest (EVALSHA)
      const sha = await this.redis.script('LOAD', SLIDING_WINDOW_LUA);
      if (typeof sha === 'string' && sha.length === 40) {
        this.slidingWindowLuaSha = sha;
      }
    } catch (error) {
      this.redis?.disconnect();
      this.redis = null;
      this.slidingWindowLuaSha = null;
      this.logger.warn(
        {
          event: 'centrifugo_connection_rate_limiter_disabled',
          reason: 'redis_unavailable_at_startup',
          ...describeRedisFailure(error),
        },
        'Centrifugo connection rate limiter disabled: Redis unavailable at startup',
      );
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
   * When Redis is unavailable the connection is always allowed (fail open).
   * Every decision is counted in `hellotalk_centrifugo_connection_rate_limit_total`
   * and refusals and fail-open decisions are logged without the user id, IP
   * address or token.
   *
   * @param userId  The authenticated user id.
   * @param ip      Client IP address, used as the key only when userId is
   *                empty.
   */
  async checkConnectionRateLimit(
    userId: string,
    ip?: string,
  ): Promise<ConnectionRateLimitResult> {
    const identityKey = userId || ip || 'anonymous';

    if (!this.redis) {
      return this.failOpen('redis_unavailable');
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

        if (!Array.isArray(raw) || raw.length === 0) {
          return this.failOpen('malformed_reply');
        }
        const allowed = Number(raw[0]) === 1;
        const retryAfterMs = raw.length >= 2 ? Number(raw[1]) || 0 : 0;
        return this.recordDecision({ allowed, retryAfterMs });
      }

      // Fallback pipeline approach (not fully atomic under contention)
      const multi = this.redis.multi();
      multi.zremrangebyscore(key, 0, windowStart);
      multi.zcard(key);
      const results = await multi.exec();

      if (!results) {
        return this.failOpen('malformed_reply');
      }

      const [, countResult] = results;
      const count = (countResult?.[1] as number) ?? 0;

      if (count >= this.connectionRateLimitPerWindow) {
        return this.recordDecision({
          allowed: false,
          retryAfterMs: this.connectionRateWindowSec * 1000,
        });
      }

      await this.redis.zadd(key, now.toString(), member);
      await this.redis.expire(key, this.connectionRateWindowSec);
      return this.recordDecision({ allowed: true, retryAfterMs: 0 });
    } catch (error) {
      return this.failOpen('redis_error', error); // allow on Redis error
    }
  }

  /**
   * Counts one limiter decision and logs refusals. The log carries only the
   * configured limit and the retry hint; the user id and IP address are never
   * logged so a refusal is correlated through the request-scoped log context.
   */
  private recordDecision(
    result: ConnectionRateLimitResult,
  ): ConnectionRateLimitResult {
    if (result.allowed) {
      this.metrics.recordCentrifugoConnectionRateLimit('allowed');
      return result;
    }

    this.metrics.recordCentrifugoConnectionRateLimit('limited');
    this.logger.warn(
      {
        event: 'centrifugo_connection_rate_limited',
        retryAfterMs: result.retryAfterMs,
        limit: this.connectionRateLimitPerWindow,
        windowSec: this.connectionRateWindowSec,
      },
      'Centrifugo connection rate limit exceeded',
    );
    return result;
  }

  /**
   * Allows the request when the limiter itself is unhealthy, but makes the
   * degradation visible: the decision is counted as `degraded` and logged with
   * a closed reason instead of being silently swallowed.
   */
  private failOpen(
    reason: RateLimiterDegradedReason,
    error?: unknown,
  ): ConnectionRateLimitResult {
    this.metrics.recordCentrifugoConnectionRateLimit('degraded');

    const context = {
      event: 'centrifugo_connection_rate_limiter_degraded',
      reason,
      ...(error === undefined ? {} : describeRedisFailure(error)),
    };
    const message =
      'Centrifugo connection rate limiter degraded; allowing connection token request';
    if (reason === 'redis_error') {
      this.logger.error(context, message);
    } else {
      this.logger.warn(context, message);
    }

    return { allowed: true, retryAfterMs: 0 };
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
      exp: Math.floor(Date.now() / 1000) + CONNECTION_TOKEN_TTL_SECONDS,
    };

    try {
      return { token: this.signConnectionJwt(payload) };
    } catch {
      this.logConnectionTokenFailure('signing_failed');
      throw new Error(CONNECTION_TOKEN_SIGNING_ERROR);
    }
  }

  /**
   * Signs a Centrifugo connection JWT payload after enforcing the connection
   * claim contract used by POST /chat/token.
   */
  signJwt(payload: Record<string, unknown>): Promise<string> {
    try {
      return Promise.resolve(this.signConnectionJwt(payload));
    } catch {
      this.logConnectionTokenFailure('signing_failed');
      return Promise.reject(new Error(CONNECTION_TOKEN_SIGNING_ERROR));
    }
  }

  private signConnectionJwt(payload: Record<string, unknown>): string {
    const subject = payload['sub'];
    const expiresAt = payload['exp'];
    const now = Math.floor(Date.now() / 1000);

    if (!this.tokenSecret) {
      throw new Error(CONNECTION_TOKEN_SIGNING_ERROR);
    }
    if (typeof subject !== 'string' || subject.trim().length === 0) {
      throw new Error(CONNECTION_TOKEN_SIGNING_ERROR);
    }
    if (
      typeof expiresAt !== 'number' ||
      !Number.isInteger(expiresAt) ||
      expiresAt <= now ||
      expiresAt > now + CONNECTION_TOKEN_TTL_SECONDS
    ) {
      throw new Error(CONNECTION_TOKEN_SIGNING_ERROR);
    }

    return jwt.sign(payload, this.tokenSecret, { algorithm: 'HS256' });
  }

  private logConnectionTokenFailure(reason: string): void {
    this.logger.error(
      {
        event: 'centrifugo_connection_token_mint_failed',
        reason,
      },
      'Centrifugo connection token mint failed',
    );
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
      if (!response.ok) return false;

      const payload: unknown = await response.json();
      if (
        typeof payload !== 'object' ||
        payload === null ||
        'error' in payload ||
        !('result' in payload)
      ) {
        return false;
      }

      return true;
    } catch (e) {
      this.logger.error(
        { error: (e as Error).message, channel },
        'Centrifugo publish error',
      );
      return false;
    }
  }

  /**
   * Publishes a voice-room chat message.
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
