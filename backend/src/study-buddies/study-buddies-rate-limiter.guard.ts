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

export const MATCHMAKING_RATE_LIMIT_KEY = 'matchmaking-rate-limit';

export interface MatchmakingRateLimitOptions {
  /** Maximum number of requests per window (per user). */
  maxRequests: number;
  /** Time window in seconds. */
  windowSeconds: number;
}

interface AuthenticatedRequest extends Request {
  user: { id: string; [key: string]: unknown };
}

/**
 * Decorator to apply per-user Redis-backed rate limiting for matchmaking
 * (Study Buddies) endpoints. Each decorated handler gets its own sliding-window
 * counter keyed by user ID + controller + handler name.
 *
 * Usage: @MatchmakingRateLimit({ maxRequests: 10, windowSeconds: 60 })
 */
export const MatchmakingRateLimit = (options: MatchmakingRateLimitOptions) =>
  SetMetadata(MATCHMAKING_RATE_LIMIT_KEY, options);

/**
 * Guard that enforces per-user Redis-based sliding window rate limits on
 * matchmaking / study-buddies endpoints.  Works alongside the global
 * ThrottlerGuard for defence-in-depth.
 *
 * Key format: `matchmaking:ratelimit:{userId}:{controller}:{handler}`
 */
@Injectable()
export class StudyBuddiesRateLimiterGuard implements CanActivate {
  constructor(
    @InjectPinoLogger(StudyBuddiesRateLimiterGuard.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const options = this.reflector.get<MatchmakingRateLimitOptions>(
      MATCHMAKING_RATE_LIMIT_KEY,
      handler,
    );

    // No matchmaking-specific rate limit metadata -- allow through
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
    const key = `matchmaking:ratelimit:${user.id}:${controller}:${handlerName}`;

    try {
      const redis = this.supabaseService.getRedisClient();
      const currentCount = await redis.incr(key);

      // Set TTL on the first request in the window
      if (currentCount === 1) {
        await redis.expire(key, options.windowSeconds);
      }

      if (currentCount > options.maxRequests) {
        const retryAfter = Math.max(
          options.windowSeconds,
          await redis.ttl(key),
        );

        this.logger.warn(
          {
            userId: user.id,
            controller,
            handler: handlerName,
            currentCount,
            maxRequests: options.maxRequests,
            windowSeconds: options.windowSeconds,
          },
          'Matchmaking rate limit exceeded',
        );

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message:
              'Too many matchmaking requests. Please wait before trying again.',
            retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (err: unknown) {
      // Re-throw HTTP exceptions (rate limit) as-is
      if (err instanceof HttpException) {
        throw err;
      }
      // Redis unavailable -- log and allow through rather than blocking all
      this.logger.error(
        {
          userId: user.id,
          controller,
          handler: handlerName,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        'Redis error in matchmaking rate limiter; allowing request through',
      );
    }

    return true;
  }
}
