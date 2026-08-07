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
  let mockRedis: { multi: jest.Mock };
  let mockSupabaseService: { getRedisClient: jest.Mock };

  function createMultiMock(incrResult: number) {
    return {
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, incrResult],
        [null, 1],
      ]),
    };
  }

  beforeEach(async () => {
    mockRedis = {
      multi: jest.fn().mockReturnValue(createMultiMock(1)),
    };

    mockSupabaseService = {
      getRedisClient: jest.fn().mockReturnValue(mockRedis),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SrsRateLimiterGuard,
        Reflector,
        {
          provide: 'PinoLogger:SrsRateLimiterGuard',
          useValue: {
            warn: jest.fn(),
            error: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
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
    jest.clearAllMocks();
  });

  function createHandler(handlerName: string): jest.Mock {
    const mock = jest.fn();
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
      expect(mockRedis.multi).not.toHaveBeenCalled();
    });

    it('should allow request when user is not authenticated', async () => {
      const context = createContext(
        { maxRequests: 30, windowSeconds: 60 },
        undefined,
      );
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(mockRedis.multi).not.toHaveBeenCalled();
    });

    it('should allow request when under rate limit', async () => {
      const multiMock = createMultiMock(5);
      mockRedis.multi.mockReturnValue(multiMock);
      const context = createContext(
        { maxRequests: 30, windowSeconds: 60 },
        'user-1',
      );

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(mockRedis.multi).toHaveBeenCalled();
      expect(multiMock.incr).toHaveBeenCalledWith(
        'srs:ratelimit:user-1:FlashcardsController:updateSrs',
      );
      expect(multiMock.expire).toHaveBeenCalledWith(
        'srs:ratelimit:user-1:FlashcardsController:updateSrs',
        60,
      );
    });

    it('should throw 429 HttpException when rate limit is exceeded', async () => {
      const multiMock = createMultiMock(31);
      mockRedis.multi.mockReturnValue(multiMock);
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
      const multiMock = {
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Redis connection refused')),
      };
      mockRedis.multi.mockReturnValue(multiMock);
      const context = createContext(
        { maxRequests: 30, windowSeconds: 60 },
        'user-1',
      );

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should use correct controller and handler names in the Redis key', async () => {
      const multiMock = createMultiMock(1);
      mockRedis.multi.mockReturnValue(multiMock);
      const context = createContext(
        { maxRequests: 10, windowSeconds: 30 },
        'user-42',
        'FlashcardsController',
        'getDueReviews',
      );

      await guard.canActivate(context);
      expect(multiMock.incr).toHaveBeenCalledWith(
        'srs:ratelimit:user-42:FlashcardsController:getDueReviews',
      );
    });

    it('should throw 429 for SRS review with strict limit', async () => {
      const multiMock = createMultiMock(121);
      mockRedis.multi.mockReturnValue(multiMock);
      const context = createContext(
        { maxRequests: 120, windowSeconds: 60 },
        'user-1',
      );

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: 429,
      });
    });

    it('should handle null result from multi/exec gracefully', async () => {
      const multiMock = {
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      mockRedis.multi.mockReturnValue(multiMock);
      const context = createContext(
        { maxRequests: 30, windowSeconds: 60 },
        'user-1',
      );

      // Should default to 0 and allow through
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });
});
