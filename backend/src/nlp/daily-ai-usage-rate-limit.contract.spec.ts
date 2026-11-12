import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LlmProxyService } from '../llm-proxy/llm-proxy.service';
import { SupabaseService } from '../supabase/supabase.service';
import { NlpService } from './nlp.service';

type RedisRateLimitMock = {
  eval: ReturnType<typeof vi.fn>;
};

describe('NlpService daily AI usage contract (#1340, #1888)', () => {
  let service: NlpService;
  let redis: RedisRateLimitMock;
  let supabase: { getRedisClient: ReturnType<typeof vi.fn> };
  let loggerWarn: ReturnType<typeof vi.spyOn>;
  let loggerError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T12:34:56.000Z'));
    loggerWarn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    loggerError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    redis = {
      eval: vi.fn().mockResolvedValue(1),
    };
    supabase = {
      getRedisClient: vi.fn().mockReturnValue(redis),
    };

    service = new NlpService(
      supabase as unknown as SupabaseService,
      { get: vi.fn() } as unknown as ConfigService,
      {} as LlmProxyService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('counts free-tier usage in a user- and UTC-date-scoped Redis key', async () => {
    await service.checkRateLimit('free-user', false);

    const key = 'daily_ai_usage:free-user:2026-08-24';
    expect(supabase.getRedisClient).toHaveBeenCalledTimes(1);
    expect(redis.eval).toHaveBeenCalledOnce();
    const [script, keyCount, actualKey, limit, ttl] = redis.eval.mock.calls[0];
    expect(keyCount).toBe(1);
    expect(actualKey).toBe(key);
    expect(limit).toBe('10');
    expect(ttl).toBe('86400');
    expect(script).toContain("redis.call('get', KEYS[1])");
    expect(script).toContain("redis.call('incr', KEYS[1])");
    expect(script).toContain("redis.call('expire', KEYS[1]");
  });

  it('atomically admits exactly ten concurrent free-tier requests', async () => {
    let count = 0;
    redis.eval.mockImplementation(() => {
      if (count >= 10) return 0;
      count += 1;
      return 1;
    });

    const results = await Promise.allSettled(
      Array.from({ length: 11 }, () =>
        service.checkRateLimit('free-user', false),
      ),
    );

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      10,
    );
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(
      1,
    );
    expect(count).toBe(10);
  });

  it('rejects a free-tier request when Redis denies admission', async () => {
    redis.eval.mockResolvedValue(0);

    let thrown: unknown;
    try {
      await service.checkRateLimit('free-user', false);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    const httpError = thrown as HttpException;
    expect(httpError.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(httpError.getResponse()).toMatchObject({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(JSON.stringify(httpError.getResponse())).toContain(
      '8 UKP / $10 USD',
    );
    expect(loggerWarn).toHaveBeenCalledWith({
      event: 'daily_ai_usage_limit_reached',
      userReference: expect.stringMatching(/^[a-f0-9]{12}$/),
      date: '2026-08-24',
      limit: 10,
    });
    expect(JSON.stringify(loggerWarn.mock.calls)).not.toContain('free-user');
  });

  it('does not consume Redis quota for VIP users', async () => {
    await expect(
      service.checkRateLimit('vip-user', true),
    ).resolves.toBeUndefined();

    expect(supabase.getRedisClient).not.toHaveBeenCalled();
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it('fails closed when Redis cannot establish the free-tier usage count', async () => {
    redis.eval.mockRejectedValue(new Error('redis unavailable'));

    await expect(service.checkRateLimit('free-user', false)).rejects.toThrow(
      'redis unavailable',
    );
    expect(loggerError).toHaveBeenCalledWith({
      event: 'daily_ai_usage_store_failure',
      userReference: expect.stringMatching(/^[a-f0-9]{12}$/),
      date: '2026-08-24',
    });
    expect(JSON.stringify(loggerError.mock.calls)).not.toContain('free-user');
  });

  it('fails closed on an unexpected Redis script response', async () => {
    redis.eval.mockResolvedValue('1');

    await expect(service.checkRateLimit('free-user', false)).rejects.toThrow(
      'Unexpected Redis daily AI usage response',
    );
    expect(loggerError).toHaveBeenCalledWith({
      event: 'daily_ai_usage_invalid_store_response',
      userReference: expect.stringMatching(/^[a-f0-9]{12}$/),
      date: '2026-08-24',
      responseType: 'string',
    });
  });
});
