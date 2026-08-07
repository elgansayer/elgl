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

export const ESCROW_RATE_LIMIT_KEY = 'escrow-rate-limit';

export interface EscrowRateLimitOptions {
  maxRequests: number;
  windowSeconds: number;
}

interface AuthenticatedRequest extends Request {
  user: { id: string; [key: string]: unknown };
}

/**
 * Decorator to apply per-user Redis-backed rate limiting for escrow endpoints.
 * Uses a sliding-window counter in Redis keyed by user ID + endpoint.
 *
 * Usage: @EscrowRateLimit({ maxRequests: 3, windowSeconds: 60 })
 */
export const EscrowRateLimit = (options: EscrowRateLimitOptions) =>
  SetMetadata(ESCROW_RATE_LIMIT_KEY, options);

/**
 * Guard that enforces per-user Redis-based sliding window rate limits on
 * escrow payment endpoints. Works alongside the global ThrottlerGuard for
 * defence-in-depth on financial operations.
 *
 * Key format: escrow:ratelimit:{userId}:{controller}:{handler}
 */
@Injectable()
export class EscrowRateLimiterGuard implements CanActivate {
  constructor(
    @InjectPinoLogger(EscrowRateLimiterGuard.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const options = this.reflector.get<EscrowRateLimitOptions>(
      ESCROW_RATE_LIMIT_KEY,
      handler,
    );

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user?.id) {
      return true;
    }

    const controller = context.getClass().name;
    const handlerName = handler.name;
    const key = `escrow:ratelimit:${user.id}:${controller}:${handlerName}`;

    try {
      const redis = this.supabaseService.getRedisClient();
      const currentCount = await redis.incr(key);

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
          'Escrow rate limit exceeded',
        );
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message:
              'Too many requests. Please wait before performing another escrow operation.',
            retryAfter: options.windowSeconds,
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
        'Redis error in escrow rate limiter; allowing request through',
      );
    }

    return true;
  }
}