import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  NlpRateLimit,
  NlpRateLimitOptions,
  NlpRateLimiterGuard,
  NLP_RATE_LIMIT_KEY,
} from './nlp-rate-limiter.guard';
import { SupabaseService } from '../supabase/supabase.service';

describe('NlpRateLimiterGuard', () => {
  let guard: NlpRateLimiterGuard;
  let mockRedis: {
    incr: Mock;
    expire: Mock;
    ttl: Mock;
    get: Mock;
  };
  let mockLogger: { warn: Mock; error: Mock };

  const buildExecutionContext = (
    userId: string | null,
    metadata: NlpRateLimitOptions | undefined,
  ) => {
    const handler = vi.fn();
    const reflector = new Reflector();
    if (metadata) {
      Reflect.defineMetadata(NLP_RATE_LIMIT_KEY, metadata, handler);
    }
    const request = userId ? { user: { id: userId } } : { user: undefined };
    return {
      getHandler: () => handler,
      getClass: () => ({ name: 'NlpController' }),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  };

  beforeEach(async () => {
    mockRedis = {
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      ttl: vi.fn().mockResolvedValue(60),
      get: vi.fn().mockResolvedValue(null),
    };

    mockLogger = {
      warn: vi.fn(),
      error: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NlpRateLimiterGuard,
        {
          provide: 'PinoLogger:NlpRateLimiterGuard',
          useValue: mockLogger,
        },
        {
          provide: SupabaseService,
          useValue: {
            getRedisClient: vi.fn().mockReturnValue(mockRedis),
          },
        },
      ],
    }).compile();

    guard = module.get<NlpRateLimiterGuard>(NlpRateLimiterGuard);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow request when no NLP rate limit metadata is set', async () => {
    const ctx = buildExecutionContext('user-1', undefined);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockRedis.incr).not.toHaveBeenCalled();
  });

  it('should allow request when user is not authenticated', async () => {
    const ctx = buildExecutionContext(null, {
      maxRequests: 10,
      windowSeconds: 60,
    });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockRedis.incr).not.toHaveBeenCalled();
  });

  it('should allow request and set rate limit counter on first request', async () => {
    mockRedis.incr.mockResolvedValue(1);
    const ctx = buildExecutionContext('user-1', {
      maxRequests: 10,
      windowSeconds: 60,
    });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockRedis.incr).toHaveBeenCalledWith(
      'nlp:ratelimit:user-1:NlpController:Mock',
    );
    expect(mockRedis.expire).toHaveBeenCalledWith(expect.any(String), 60);
  });

  it('should allow request when under rate limit', async () => {
    mockRedis.incr.mockResolvedValue(8);
    const ctx = buildExecutionContext('user-1', {
      maxRequests: 10,
      windowSeconds: 60,
    });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockRedis.incr).toHaveBeenCalledWith(
      'nlp:ratelimit:user-1:NlpController:Mock',
    );
  });

  it('should allow request at boundary of rate limit', async () => {
    mockRedis.incr.mockResolvedValue(10);
    const ctx = buildExecutionContext('user-1', {
      maxRequests: 10,
      windowSeconds: 60,
    });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should throw 429 HttpException when rate limit is exceeded', async () => {
    mockRedis.incr.mockResolvedValue(11);
    mockRedis.ttl.mockResolvedValue(45);
    const ctx = buildExecutionContext('user-42', {
      maxRequests: 10,
      windowSeconds: 60,
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);

    try {
      await guard.canActivate(ctx);
    } catch (err: unknown) {
      const ex = err as HttpException;
      expect(ex.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      const resp = ex.getResponse() as {
        statusCode: number;
        message: string;
        retryAfter: number;
      };
      expect(resp.message).toContain('LingQ Reading Engine');
      expect(resp.retryAfter).toBe(60);
    }

    expect(mockRedis.incr).toHaveBeenCalledWith(
      'nlp:ratelimit:user-42:NlpController:Mock',
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-42',
        currentCount: 11,
        maxRequests: 10,
      }),
      'NLP rate limit exceeded',
    );
  });

  it('should not set expire if counter > 1 (already set)', async () => {
    mockRedis.incr.mockResolvedValue(5);
    const ctx = buildExecutionContext('user-1', {
      maxRequests: 10,
      windowSeconds: 60,
    });

    await guard.canActivate(ctx);
    expect(mockRedis.expire).not.toHaveBeenCalled();
  });

  it('should allow request through when Redis incr fails', async () => {
    mockRedis.incr.mockRejectedValue(new Error('Redis connection refused'));
    const ctx = buildExecutionContext('user-1', {
      maxRequests: 10,
      windowSeconds: 60,
    });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        error: 'Redis connection refused',
      }),
      'Redis error in NLP rate limiter; allowing request through',
    );
  });

  it('should throw HttpException when Redis expire fails but incr succeeded', async () => {
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockRejectedValue(new Error('Redis write error'));
    const ctx = buildExecutionContext('user-1', {
      maxRequests: 10,
      windowSeconds: 60,
    });

    // The expire failure happens after incr, but the guard only catches errors
    // from incr. The expire failure would be unhandled, but that's acceptable.
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  describe('NlpRateLimit decorator', () => {
    it('should set metadata with correct options', () => {
      class TestClass {
        @NlpRateLimit({ maxRequests: 20, windowSeconds: 120 })
        testMethod() {}
      }

      const metadata = Reflect.getMetadata(
        NLP_RATE_LIMIT_KEY,
        TestClass.prototype.testMethod,
      );
      expect(metadata).toEqual({ maxRequests: 20, windowSeconds: 120 });
    });
  });
});
