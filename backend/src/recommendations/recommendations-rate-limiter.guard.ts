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

export const RECOMMENDATIONS_RATE_LIMIT_KEY = 'recommendations-rate-limit';

export interface RecommendationsRateLimitOptions {
  freeMaxRequests: number;
  vipMaxRequests: number;
  windowSeconds: number;
}

interface AuthenticatedRequest extends Request {
  user: { id: string; [key: string]: unknown };
}

export const RecommendationsRateLimit = (
  options: RecommendationsRateLimitOptions,
) => SetMetadata(RECOMMENDATIONS_RATE_LIMIT_KEY, options);

/**
 * Guard that enforces per-user Redis-based sliding window rate limits on
 * matchmaking / recommendations endpoints.
 *
 * Key format: `matchmaking:ratelimit:{userId}:{controller}:{handler}`
 *
 * Free users have a lower allowance; VIP users have extended limits with
 * Redis-cached VIP status lookups to avoid repeated DB hits.
 */
@Injectable()
export class RecommendationsRateLimiterGuard implements CanActivate {
  private static readonly VIP_CACHE_TTL_SECONDS = 60;

  constructor(
    @InjectPinoLogger(RecommendationsRateLimiterGuard.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const options = this.reflector.get<RecommendationsRateLimitOptions>(
      RECOMMENDATIONS_RATE_LIMIT_KEY,
      handler,
    );

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user || !user.id) {
      return true;
    }

    const controller = context.getClass().name;
    const handlerName = handler.name;
    const key = `matchmaking:ratelimit:${user.id}:${controller}:${handlerName}`;

    try {
      const isVip = await this.resolveVipStatus(user.id);
      const maxRequests = isVip
        ? options.vipMaxRequests
        : options.freeMaxRequests;

      const redis = this.supabaseService.getRedisClient();
      const currentCount = await redis.incr(key);

      if (currentCount === 1) {
        await redis.expire(key, options.windowSeconds);
      }

      if (currentCount > maxRequests) {
        const retryAfter = Math.max(
          options.windowSeconds,
          await redis.ttl(key),
        );

        this.logger.warn(
          {
            userId: user.id,
            isVip,
            maxRequests,
            controller,
            handler: handlerName,
            currentCount,
            windowSeconds: options.windowSeconds,
          },
          'Recommendations rate limit exceeded',
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
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(
        {
          userId: user.id,
          controller,
          handler: handlerName,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        'Redis error in recommendations rate limiter; allowing request through',
      );
    }

    return true;
  }

  private async resolveVipStatus(userId: string): Promise<boolean> {
    const redis = this.supabaseService.getRedisClient();
    const cacheKey = `user:vip:${userId}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached !== null) {
        return cached === '1';
      }
    } catch {
      // Redis read error; fall through to DB lookup
    }

    try {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase
        .from('users')
        .select('is_vip')
        .eq('id', userId)
        .single();

      const isVip = !error && data ? Boolean(data.is_vip) : false;

      try {
        await redis.set(
          cacheKey,
          isVip ? '1' : '0',
          'EX',
          RecommendationsRateLimiterGuard.VIP_CACHE_TTL_SECONDS,
        );
      } catch {
        // Cache write failure is non-critical
      }

      return isVip;
    } catch {
      // DB error; default to free tier
      return false;
    }
  }
}
