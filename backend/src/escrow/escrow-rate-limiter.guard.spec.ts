import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  EscrowRateLimiterGuard,
  EscrowRateLimit,
  ESCROW_RATE_LIMIT_KEY,
} from './escrow-rate-limiter.guard';
import { SupabaseService } from '../supabase/supabase.service';

describe('EscrowRateLimiterGuard', () => {
  let guard: EscrowRateLimiterGuard;
  let mockRedis: any;
  let reflector: Reflector;

  beforeEach(async () => {
    mockRedis = {
      incr: jest.fn(),
      expire: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowRateLimiterGuard,
        {
          provide: 'PinoLogger:EscrowRateLimiterGuard',
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getRedisClient: jest.fn().mockReturnValue(mockRedis),
          },
        },
        Reflector,
      ],
    }).compile();

    guard = module.get<EscrowRateLimiterGuard>(EscrowRateLimiterGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockContext = (
    handlerName: string,
    handlerOptions?: { maxRequests: number; windowSeconds: number },
    userId?: string | null,
  ) => {
    const mockHandler = { name: handlerName };
    if (handlerOptions) {
      Reflect.defineMetadata(ESCROW_RATE_LIMIT_KEY, handlerOptions, mockHandler);
    }

    return {
      getHandler: () => mockHandler,
      getClass: () => ({ name: 'EscrowController' }),
      switchToHttp: () => ({
        getRequest: () => ({
          user: userId ? { id: userId } : undefined,
        }),
      }),
    } as any;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow request when no rate limit decorator is set', async () => {
    const context = createMockContext('testHandler');
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockRedis.incr).not.toHaveBeenCalled();
  });

  it('should allow request when user is not authenticated', async () => {
    const context = createMockContext(
      'testHandler',
      { maxRequests: 5, windowSeconds: 60 },
      null,
    );
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockRedis.incr).not.toHaveBeenCalled();
  });

  it('should allow request when under the rate limit', async () => {
    const context = createMockContext(
      'testHandler',
      { maxRequests: 5, windowSeconds: 60 },
      'user-1',
    );
    mockRedis.incr.mockResolvedValue(3);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockRedis.incr).toHaveBeenCalledWith(
      'escrow:ratelimit:user-1:EscrowController:testHandler',
    );
    expect(mockRedis.expire).not.toHaveBeenCalled();
  });

  it('should set TTL on first request in the window', async () => {
    const context = createMockContext(
      'testHandler',
      { maxRequests: 5, windowSeconds: 120 },
      'user-1',
    );
    mockRedis.incr.mockResolvedValue(1);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockRedis.expire).toHaveBeenCalledWith(
      'escrow:ratelimit:user-1:EscrowController:testHandler',
      120,
    );
  });

  it('should block request when rate limit exceeded', async () => {
    const context = createMockContext(
      'testHandler',
      { maxRequests: 5, windowSeconds: 60 },
      'user-2',
    );
    mockRedis.incr.mockResolvedValue(6);

    try {
      await guard.canActivate(context);
      fail('Expected HttpException to be thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(HttpException);
      const httpErr = err as HttpException;
      expect(httpErr.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      const response = httpErr.getResponse() as Record<string, unknown>;
      expect(response.statusCode).toBe(429);
      expect(response.retryAfter).toBe(60);
    }
  });

  it('should allow request through when Redis is unavailable', async () => {
    const context = createMockContext(
      'testHandler',
      { maxRequests: 5, windowSeconds: 60 },
      'user-1',
    );
    mockRedis.incr.mockRejectedValue(new Error('Redis connection failed'));

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should re-throw HttpException from Redis layer', async () => {
    const context = createMockContext(
      'testHandler',
      { maxRequests: 5, windowSeconds: 60 },
      'user-1',
    );
    const httpEx = new HttpException('Test', HttpStatus.TOO_MANY_REQUESTS);
    mockRedis.incr.mockRejectedValue(httpEx);

    await expect(guard.canActivate(context)).rejects.toThrow(httpEx);
  });

  describe('EscrowRateLimit decorator', () => {
    it('should set metadata on a method', () => {
      class TestClass {
        @EscrowRateLimit({ maxRequests: 10, windowSeconds: 30 })
        testMethod() {}
      }

      const metadata = Reflect.getMetadata(
        ESCROW_RATE_LIMIT_KEY,
        TestClass.prototype.testMethod,
      );
      expect(metadata).toEqual({ maxRequests: 10, windowSeconds: 30 });
    });
  });
});