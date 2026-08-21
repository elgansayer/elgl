import type { Mock, Mocked } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PinoLogger } from 'nestjs-pino';
import {
  RecommendationsRateLimiterGuard,
  RecommendationsRateLimit,
  RECOMMENDATIONS_RATE_LIMIT_KEY,
  RecommendationsRateLimitOptions,
} from './recommendations-rate-limiter.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { ExecutionContext } from '@nestjs/common';

describe('RecommendationsRateLimiterGuard', () => {
  let guard: RecommendationsRateLimiterGuard;
  let redisMock: {
    incr: Mock;
    expire: Mock;
    ttl: Mock;
    get: Mock;
    set: Mock;
  };
  let supabaseClientMock: { from: Mock };
  let supabaseService: Mocked<
    Pick<SupabaseService, 'getRedisClient' | 'getClient'>
  >;
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
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };

    supabaseClientMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    };

    supabaseService = {
      getRedisClient: vi.fn().mockReturnValue(redisMock),
      getClient: vi.fn().mockReturnValue(supabaseClientMock),
    };

    reflector = {
      get: vi.fn().mockReturnValue(undefined),
    };

    logger = {
      warn: vi.fn(),
      error: vi.fn(),
    };

    guard = new RecommendationsRateLimiterGuard(
      logger as unknown as PinoLogger,
      supabaseService as unknown as SupabaseService,
      reflector as unknown as Reflector,
    );
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('when no rate limit metadata is defined', () => {
    it('should allow the request through', async () => {
      const handler = () => {
        /* empty */
      };
      class TestController {}
      const context = createMockExecutionContext(
        'user-1',
        handler,
        TestController,
      );
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(redisMock.incr).not.toHaveBeenCalled();
    });
  });

  describe('when rate limit metadata is defined', () => {
    const options: RecommendationsRateLimitOptions = {
      freeMaxRequests: 30,
      vipMaxRequests: 120,
      windowSeconds: 60,
    };

    const handler = () => {
      /* empty */
    };
    class TestController {}

    beforeEach(() => {
      (reflector.get as Mock).mockImplementation((key: string) => {
        if (key === RECOMMENDATIONS_RATE_LIMIT_KEY) return options;
        return undefined;
      });
    });

    it('should allow request when count is within free limit', async () => {
      redisMock.incr.mockResolvedValue(25);

      const context = createMockExecutionContext(
        'user-1',
        handler,
        TestController,
      );
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should set TTL on first request in the window', async () => {
      redisMock.incr.mockResolvedValue(1);

      const context = createMockExecutionContext(
        'user-2',
        handler,
        TestController,
      );
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(redisMock.expire).toHaveBeenCalledWith(
        'matchmaking:ratelimit:user-2:TestController:handler',
        60,
      );
    });

    it('should not set TTL on subsequent requests', async () => {
      redisMock.incr.mockResolvedValue(4);

      const context = createMockExecutionContext(
        'user-3',
        handler,
        TestController,
      );
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(redisMock.expire).not.toHaveBeenCalled();
    });

    it('should block free user when free limit exceeded', async () => {
      redisMock.incr.mockResolvedValue(31);

      const context = createMockExecutionContext(
        'user-1',
        handler,
        TestController,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('should allow VIP user to exceed free limit but stay within VIP limit', async () => {
      redisMock.incr.mockResolvedValue(50);
      redisMock.get.mockResolvedValue('1'); // VIP cached

      const context = createMockExecutionContext(
        'vip-user',
        handler,
        TestController,
      );
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should block VIP user when VIP limit exceeded', async () => {
      redisMock.incr.mockResolvedValue(121);
      redisMock.get.mockResolvedValue('1'); // VIP cached

      const context = createMockExecutionContext(
        'vip-user',
        handler,
        TestController,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    });

    it('should log warning when rate limit is exceeded', async () => {
      redisMock.incr.mockResolvedValue(35);

      const context = createMockExecutionContext(
        'user-1',
        handler,
        TestController,
      );
      try {
        await guard.canActivate(context);
      } catch {
        // Expected
      }

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          currentCount: 35,
          maxRequests: 30,
          windowSeconds: 60,
        }),
        'Recommendations rate limit exceeded',
      );
    });

    it('should allow request if user is not authenticated', async () => {
      const context = createMockExecutionContext(
        undefined,
        handler,
        TestController,
      );
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(redisMock.incr).not.toHaveBeenCalled();
    });

    it('should allow request and log error if Redis is unavailable', async () => {
      redisMock.incr.mockRejectedValue(new Error('Redis connection error'));

      const context = createMockExecutionContext(
        'user-1',
        handler,
        TestController,
      );
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          error: 'Redis connection error',
        }),
        'Redis error in recommendations rate limiter; allowing request through',
      );
    });

    it('should resolve VIP status from Redis cache when cached', async () => {
      redisMock.incr.mockResolvedValue(50);
      redisMock.get.mockResolvedValue('1'); // VIP cached

      const context = createMockExecutionContext(
        'vip-user',
        handler,
        TestController,
      );
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(supabaseClientMock.from).not.toHaveBeenCalled();
    });

    it('should fall back to DB when Redis cache miss for VIP', async () => {
      redisMock.incr.mockResolvedValue(5);
      redisMock.get.mockResolvedValue(null); // cache miss
      supabaseClientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { is_vip: true },
              error: null,
            }),
          }),
        }),
      });

      const context = createMockExecutionContext(
        'vip-user',
        handler,
        TestController,
      );
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(redisMock.set).toHaveBeenCalledWith(
        'user:vip:vip-user',
        '1',
        'EX',
        60,
      );
    });

    it('should default to free tier when DB fails and cache is empty', async () => {
      redisMock.incr.mockResolvedValue(31); // exceeds free limit
      redisMock.get.mockResolvedValue(null);
      supabaseClientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(new Error('DB down')),
          }),
        }),
      });

      const context = createMockExecutionContext(
        'user-db-down',
        handler,
        TestController,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    });

    it('should include retryAfter in the rate limit response', async () => {
      redisMock.incr.mockResolvedValue(31);
      redisMock.ttl.mockResolvedValue(45);

      const context = createMockExecutionContext(
        'user-1',
        handler,
        TestController,
      );
      try {
        await guard.canActivate(context);
      } catch (err: unknown) {
        const response = (err as HttpException).getResponse() as Record<
          string,
          unknown
        >;
        expect(response['retryAfter']).toBe(60);
      }
    });
  });

  describe('RecommendationsRateLimit decorator', () => {
    it('should set metadata on the handler', () => {
      const opts: RecommendationsRateLimitOptions = {
        freeMaxRequests: 20,
        vipMaxRequests: 80,
        windowSeconds: 30,
      };

      class DecoratorTest {
        testMethod() {
          /* empty */
        }
      }
      const desc = Object.getOwnPropertyDescriptor(
        DecoratorTest.prototype,
        'testMethod',
      );
      RecommendationsRateLimit(opts)(
        DecoratorTest.prototype,
        'testMethod',
        desc!,
      );

      const metadata = Reflect.getMetadata(
        RECOMMENDATIONS_RATE_LIMIT_KEY,
        DecoratorTest.prototype.testMethod,
      );
      expect(metadata).toEqual(opts);
    });
  });
});
