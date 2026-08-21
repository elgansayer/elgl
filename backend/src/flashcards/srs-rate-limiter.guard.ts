import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { Request } from 'express';

export const SRS_RATE_LIMIT_KEY = 'srs-rate-limit';

export interface SrsRateLimitOptions {
  /** Maximum number of requests per window (per user). */
  maxRequests: number;
  /** Time window in seconds. */
  windowSeconds: number;
}

interface AuthenticatedRequest extends Request {
  user: { id: string; [key: string]: unknown };
}

/**
 * Decorator to apply per-user Redis-backed rate limiting for SRS endpoints.
 * Uses a sliding-window counter in Redis keyed by user ID + endpoint.
 *
 * Usage: @SrsRateLimit({ maxRequests: 120, windowSeconds: 60 })
 */
export const SrsRateLimit = (options: SrsRateLimitOptions) =>
  SetMetadata(SRS_RATE_LIMIT_KEY, options);

/**
 * Guard that enforces per-user Redis-based sliding window rate limits on SRS endpoints.
 * Works alongside the global ThrottlerGuard for defence-in-depth.
 *
 * Key format: `srs:ratelimit:{userId}:{controller}:{handler}`
 * Uses a simple counter with TTL per window rather than full sorted-set sliding window
 * to keep the implementation lightweight and Redis-compatible.
 */
@Injectable()
export class SrsRateLimiterGuard implements CanActivate {
  constructor(
    @InjectPinoLogger(SrsRateLimiterGuard.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const options = this.reflector.get<SrsRateLimitOptions>(
      SRS_RATE_LIMIT_KEY,
      handler,
    );

    // No SRS-specific rate limit defined; allow through
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    // Unauthenticated requests are blocked by SupabaseAuthGuard before this
    if (!user?.id) {
      return true;
    }

    const controller = context.getClass().name;
    const handlerName = handler.name;
    const key = `srs:ratelimit:${user.id}:${controller}:${handlerName}`;

    try {
      const redis = this.supabaseService.getRedisClient();
      const currentCount = await redis.incr(key);

      // Set TTL on first request in the window
      if (currentCount === 1) {
        await redis.expire(key, options.windowSeconds);
      }

      if (currentCount > options.maxRequests) {
        this.logger.warn(
          {
            userId: user.id,
            controller,
            handler: handlerName,
            currentCount,
            maxRequests: options.maxRequests,
            windowSeconds: options.windowSeconds,
          },
          'SRS rate limit exceeded',
        );
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests. Please slow down your review pace.',
            retryAfter: options.windowSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (err: unknown) {
      // Re-throw HTTP exceptions (rate limit) as-is
      if (err instanceof HttpException) {
        throw err;
      }
      // If Redis is unavailable, log and allow the request through rather than blocking all traffic
      this.logger.error(
        {
          userId: user.id,
          controller,
          handler: handlerName,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        'Redis error in SRS rate limiter; allowing request through',
      );
    }

    return true;
  }
}
