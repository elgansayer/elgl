import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LlmProxyService } from '../llm-proxy/llm-proxy.service';
import { SupabaseService } from '../supabase/supabase.service';
import { NlpService } from './nlp.service';

type RedisRateLimitMock = {
  get: ReturnType<typeof vi.fn>;
  incr: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
};

describe('NlpService daily AI usage contract (#1340)', () => {
  let service: NlpService;
  let redis: RedisRateLimitMock;
  let supabase: { getRedisClient: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T12:34:56.000Z'));

    redis = {
      get: vi.fn().mockResolvedValue(null),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
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
    expect(redis.get).toHaveBeenCalledWith(key);
    expect(redis.incr).toHaveBeenCalledWith(key);
    expect(redis.expire).toHaveBeenCalledWith(key, 86_400);
  });

  it('allows the tenth free-tier request and keeps the existing expiry', async () => {
    redis.get.mockResolvedValue('9');
    redis.incr.mockResolvedValue(10);

    await expect(
      service.checkRateLimit('free-user', false),
    ).resolves.toBeUndefined();

    expect(redis.incr).toHaveBeenCalledWith(
      'daily_ai_usage:free-user:2026-08-24',
    );
    expect(redis.expire).not.toHaveBeenCalled();
  });

  it('rejects the eleventh free-tier request before incrementing usage', async () => {
    redis.get.mockResolvedValue('10');

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
    expect(redis.incr).not.toHaveBeenCalled();
    expect(redis.expire).not.toHaveBeenCalled();
  });

  it('does not consume Redis quota for VIP users', async () => {
    await expect(
      service.checkRateLimit('vip-user', true),
    ).resolves.toBeUndefined();

    expect(supabase.getRedisClient).not.toHaveBeenCalled();
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.incr).not.toHaveBeenCalled();
    expect(redis.expire).not.toHaveBeenCalled();
  });

  it('fails closed when Redis cannot establish the free-tier usage count', async () => {
    redis.get.mockRejectedValue(new Error('redis unavailable'));

    await expect(service.checkRateLimit('free-user', false)).rejects.toThrow(
      'redis unavailable',
    );
    expect(redis.incr).not.toHaveBeenCalled();
  });
});
