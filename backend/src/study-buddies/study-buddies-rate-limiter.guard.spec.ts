import type { Mock, Mocked } from 'vitest';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PinoLogger } from 'nestjs-pino';
import {
  StudyBuddiesRateLimiterGuard,
  MatchmakingRateLimit,
  MATCHMAKING_RATE_LIMIT_KEY,
  MatchmakingRateLimitOptions,
} from './study-buddies-rate-limiter.guard';
import { SupabaseService } from '../supabase/supabase.service';

describe('StudyBuddiesRateLimiterGuard', () => {
  let guard: StudyBuddiesRateLimiterGuard;
  let redisMock: { incr: Mock; expire: Mock; ttl: Mock };
  let supabaseService: Mocked<Pick<SupabaseService, 'getRedisClient'>>;
  let reflector: Mocked<Pick<Reflector, 'get'>>;
  let logger: Mocked<Pick<PinoLogger, 'warn' | 'error'>>;

  function createMockExecutionContext(
    userId: string | undefined,
    handler: () => void,
    controllerClass: new (...args: unknown[]) => unknown,
  ): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => controllerClass,
      switchToHttp: () => ({
        getRequest: () => ({
          user: userId ? { id: userId } : undefined,
        }),
        getResponse: vi.fn(),
        getNext: vi.fn(),
      }),
      getType: () => 'http',
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    redisMock = {
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      ttl: vi.fn().mockResolvedValue(60),
    };

    supabaseService = {
      getRedisClient: vi.fn().mockReturnValue(redisMock),
    };

    reflector = {
      get: vi.fn().mockReturnValue(undefined),
    };

    logger = {
      warn: vi.fn(),
      error: vi.fn(),
    };

    guard = new StudyBuddiesRateLimiterGuard(
      logger as unknown as PinoLogger,
      supabaseService as unknown as SupabaseService,
      reflector as unknown as Reflector,
    );
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('when no rate limit metadata is defined', () => {
    it('allows the request through', async () => {
      const handler = function () {};
      class TestController {}
      const ctx = createMockExecutionContext('user-1', handler, TestController);
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(redisMock.incr).not.toHaveBeenCalled();
    });
  });

  describe('when the user is not authenticated', () => {
    it('allows the request through', async () => {
      const handler = function () {};
      class TestController {}

      (reflector.get as Mock).mockImplementation((key: string) => {
        if (key === MATCHMAKING_RATE_LIMIT_KEY)
          return { maxRequests: 5, windowSeconds: 60 };
        return undefined;
      });

      const ctx = createMockExecutionContext(
        undefined,
        handler,
        TestController,
      );
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(redisMock.incr).not.toHaveBeenCalled();
    });
  });

  describe('with rate limit metadata', () => {
    const options: MatchmakingRateLimitOptions = {
      maxRequests: 5,
      windowSeconds: 60,
    };

    const handler = async function () {};
    class TestController {}

    beforeEach(() => {
      (reflector.get as Mock).mockImplementation((key: string) => {
        if (key === MATCHMAKING_RATE_LIMIT_KEY) return options;
        return undefined;
      });
    });

    it('allows requests within the limit', async () => {
      redisMock.incr.mockResolvedValue(3);

      const ctx = createMockExecutionContext('user-1', handler, TestController);
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(redisMock.incr).toHaveBeenCalledWith(
        'matchmaking:ratelimit:user-1:TestController:handler',
      );
      expect(redisMock.expire).not.toHaveBeenCalled();
    });

    it('sets TTL on the first request in the window', async () => {
      redisMock.incr.mockResolvedValue(1);

      const ctx = createMockExecutionContext('user-2', handler, TestController);
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(redisMock.expire).toHaveBeenCalledWith(
        'matchmaking:ratelimit:user-2:TestController:handler',
        60,
      );
    });

    it('rejects requests exceeding the limit', async () => {
      redisMock.incr.mockResolvedValue(6);
      redisMock.ttl.mockResolvedValue(45);

      const ctx = createMockExecutionContext('user-1', handler, TestController);
      await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
        message:
          'Too many matchmaking requests. Please wait before trying again.',
      });
    });

    it('logs a warning when rate limit is exceeded', async () => {
      redisMock.incr.mockResolvedValue(10);

      const ctx = createMockExecutionContext('user-1', handler, TestController);
      try {
        await guard.canActivate(ctx);
      } catch {
        // Expected
      }

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          currentCount: 10,
          maxRequests: 5,
          windowSeconds: 60,
        }),
        'Matchmaking rate limit exceeded',
      );
    });

    it('includes retryAfter in the error body using Redis TTL', async () => {
      redisMock.incr.mockResolvedValue(7);
      redisMock.ttl.mockResolvedValue(42);

      const ctx = createMockExecutionContext('user-1', handler, TestController);
      let caught: HttpException | undefined;
      try {
        await guard.canActivate(ctx);
      } catch (err: unknown) {
        caught = err as HttpException;
      }

      const response = caught!.getResponse() as Record<string, unknown>;
      expect(response.retryAfter).toBe(60); // Math.max(windowSeconds=60, ttl=42)
    });
  });

  describe('Redis error handling', () => {
    const handler = async function () {};
    class TestController {}

    beforeEach(() => {
      (reflector.get as Mock).mockImplementation((key: string) => {
        if (key === MATCHMAKING_RATE_LIMIT_KEY)
          return { maxRequests: 5, windowSeconds: 60 };
        return undefined;
      });
    });

    it('allows the request through if Redis is unavailable', async () => {
      redisMock.incr.mockRejectedValue(new Error('Connection refused'));

      const ctx = createMockExecutionContext('user-1', handler, TestController);
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          error: 'Connection refused',
        }),
        'Redis error in matchmaking rate limiter; allowing request through',
      );
    });
  });

  describe('MatchmakingRateLimit decorator', () => {
    it('sets metadata on the handler', () => {
      const opts: MatchmakingRateLimitOptions = {
        maxRequests: 10,
        windowSeconds: 30,
      };

      class DecoratorTest {
        testMethod() {}
      }
      const desc = Object.getOwnPropertyDescriptor(
        DecoratorTest.prototype,
        'testMethod',
      );
      MatchmakingRateLimit(opts)(DecoratorTest.prototype, 'testMethod', desc!);

      const metadata = Reflect.getMetadata(
        MATCHMAKING_RATE_LIMIT_KEY,
        DecoratorTest.prototype.testMethod,
      );
      expect(metadata).toEqual(opts);
    });
  });
});
