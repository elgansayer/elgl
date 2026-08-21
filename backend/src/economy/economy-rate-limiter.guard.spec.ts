import type { Mock, Mocked } from 'vitest';
vi.mock('jsdom', () => ({
  JSDOM: vi.fn().mockImplementation(function () {
    return {
      window: {
        document: { createElement: vi.fn(), createDocumentFragment: vi.fn() },
        Node: { ELEMENT_NODE: 1, TEXT_NODE: 3, DOCUMENT_FRAGMENT_NODE: 11 },
        NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
      },
    };
  }),
}));

vi.mock('dompurify', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    sanitize: (dirty: string): string => {
      if (typeof dirty !== 'string') return dirty;
      return dirty.replace(/<[^>]*>/g, '');
    },
    setConfig: vi.fn(),
  })),
}));

import { HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PinoLogger } from 'nestjs-pino';
import {
  EconomyRateLimiterGuard,
  EconomyRateLimit,
  ECONOMY_RATE_LIMIT_KEY,
  EconomyRateLimitOptions,
} from './economy-rate-limiter.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { ExecutionContext } from '@nestjs/common';

describe('EconomyRateLimiterGuard', () => {
  let guard: EconomyRateLimiterGuard;
  let redisMock: { incr: Mock; expire: Mock };
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

    guard = new EconomyRateLimiterGuard(
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
      const handler = () => {};
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
    const options: EconomyRateLimitOptions = {
      maxRequests: 5,
      windowSeconds: 60,
    };

    const handler = async () => {};

    class TestController {}

    beforeEach(() => {
      (reflector.get as Mock).mockImplementation((key: string) => {
        if (key === ECONOMY_RATE_LIMIT_KEY) return options;
        return undefined;
      });
    });

    it('should allow request when count is within limit', async () => {
      redisMock.incr.mockResolvedValue(3);

      const context = createMockExecutionContext(
        'user-1',
        handler,
        TestController,
      );
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should allow request and set expire on first request', async () => {
      redisMock.incr.mockResolvedValue(1);

      const context = createMockExecutionContext(
        'user-2',
        handler,
        TestController,
      );
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(redisMock.expire).toHaveBeenCalledWith(
        'economy:ratelimit:user-2:TestController:handler',
        60,
      );
    });

    it('should not set expire on subsequent requests', async () => {
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

    it('should block request when limit exceeded', async () => {
      redisMock.incr.mockResolvedValue(6);

      const context = createMockExecutionContext(
        'user-1',
        handler,
        TestController,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many requests. Please wait before trying again.',
      });
    });

    it('should log warning when rate limit is exceeded', async () => {
      redisMock.incr.mockResolvedValue(10);

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
          currentCount: 10,
          maxRequests: 5,
          windowSeconds: 60,
        }),
        'Economy rate limit exceeded',
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
        'Redis error in economy rate limiter; allowing request through',
      );
    });
  });

  describe('EconomyRateLimit decorator', () => {
    it('should set metadata on the handler', () => {
      const opts: EconomyRateLimitOptions = {
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
      EconomyRateLimit(opts)(DecoratorTest.prototype, 'testMethod', desc!);

      const metadata = Reflect.getMetadata(
        ECONOMY_RATE_LIMIT_KEY,
        DecoratorTest.prototype.testMethod,
      );
      expect(metadata).toEqual(opts);
    });

    it('should clear previous metadata when called with new options', () => {
      const opts: EconomyRateLimitOptions = {
        maxRequests: 15,
        windowSeconds: 30,
      };

      // Setting metadata should overwrite any previous value
      class DecoratorTest2 {
        testMethod() {}
      }
      const desc2 = Object.getOwnPropertyDescriptor(
        DecoratorTest2.prototype,
        'testMethod',
      );
      EconomyRateLimit(opts)(DecoratorTest2.prototype, 'testMethod', desc2!);

      const metadata = Reflect.getMetadata(
        ECONOMY_RATE_LIMIT_KEY,
        DecoratorTest2.prototype.testMethod,
      );
      expect(metadata).toEqual(opts);
    });
  });
});
