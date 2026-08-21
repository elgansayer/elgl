import type { Mock } from 'vitest';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../supabase/supabase.service';
import {
  SrsRateLimiterGuard,
  SRS_RATE_LIMIT_KEY,
} from './srs-rate-limiter.guard';

describe('SrsRateLimiterGuard', () => {
  let guard: SrsRateLimiterGuard;
  let mockRedis: { incr: Mock; expire: Mock };
  let mockSupabaseService: { getRedisClient: Mock };

  beforeEach(async () => {
    mockRedis = {
      incr: vi.fn(),
      expire: vi.fn(),
    };

    mockSupabaseService = {
      getRedisClient: vi.fn().mockReturnValue(mockRedis),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SrsRateLimiterGuard,
        Reflector,
        {
          provide: 'PinoLogger:SrsRateLimiterGuard',
          useValue: {
            warn: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
          },
        },
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    guard = await module.resolve(SrsRateLimiterGuard);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function createHandler(handlerName: string): Mock {
    const mock = vi.fn();
    Object.defineProperty(mock, 'name', { value: handlerName });
    return mock;
  }

  function createContext(
    options: { maxRequests: number; windowSeconds: number } | undefined,
    userId: string | undefined,
    controllerName = 'FlashcardsController',
    handlerName = 'updateSrs',
  ): ExecutionContext {
    const handler = createHandler(handlerName);
    const controllerClass = { name: controllerName };

    const context = {
      getHandler: () => handler,
      getClass: () => controllerClass,
      switchToHttp: () => ({
        getRequest: () => ({
          user: userId ? { id: userId } : undefined,
        }),
      }),
    } as unknown as ExecutionContext;

    if (options) {
      Reflect.defineMetadata(SRS_RATE_LIMIT_KEY, options, handler);
    }

    return context;
  }

  describe('canActivate', () => {
    it('should allow request when no SRS rate limit metadata is set', async () => {
      const context = createContext(undefined, 'user-1');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(mockRedis.incr).not.toHaveBeenCalled();
    });

    it('should allow request when user is not authenticated', async () => {
      const context = createContext(
        { maxRequests: 30, windowSeconds: 60 },
        undefined,
      );
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(mockRedis.incr).not.toHaveBeenCalled();
    });

    it('should allow request when under rate limit', async () => {
      mockRedis.incr.mockResolvedValue(5);
      const context = createContext(
        { maxRequests: 30, windowSeconds: 60 },
        'user-1',
      );

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(mockRedis.incr).toHaveBeenCalledWith(
        'srs:ratelimit:user-1:FlashcardsController:updateSrs',
      );
      // TTL should NOT be set since count > 1
      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it('should set TTL on first request in the window', async () => {
      mockRedis.incr.mockResolvedValue(1);
      const context = createContext(
        { maxRequests: 30, windowSeconds: 60 },
        'user-1',
      );

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(mockRedis.incr).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'srs:ratelimit:user-1:FlashcardsController:updateSrs',
        60,
      );
    });

    it('should throw 429 HttpException when rate limit is exceeded', async () => {
      mockRedis.incr.mockResolvedValue(31); // over maxRequests of 30
      const context = createContext(
        { maxRequests: 30, windowSeconds: 60 },
        'user-1',
      );

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: 429,
      });
    });

    it('should allow request through when Redis is unavailable (fail-open)', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Redis connection refused'));
      const context = createContext(
        { maxRequests: 30, windowSeconds: 60 },
        'user-1',
      );

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should use correct controller and handler names in the Redis key', async () => {
      mockRedis.incr.mockResolvedValue(1);
      const context = createContext(
        { maxRequests: 10, windowSeconds: 30 },
        'user-42',
        'FlashcardsController',
        'getDueReviews',
      );

      await guard.canActivate(context);
      expect(mockRedis.incr).toHaveBeenCalledWith(
        'srs:ratelimit:user-42:FlashcardsController:getDueReviews',
      );
    });

    it('should throw 429 for SRS review with strict limit', async () => {
      mockRedis.incr.mockResolvedValue(121); // over maxRequests of 120
      const context = createContext(
        { maxRequests: 120, windowSeconds: 60 },
        'user-1',
      );

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: 429,
      });
    });
  });
});
