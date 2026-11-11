import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { User } from '@supabase/supabase-js';
import { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import { SupabaseService } from '../../supabase/supabase.service';

const DEVELOPER_API_KEY_PATTERN = /^ht_dev_[0-9a-f]{32}$/i;
const DEVELOPER_RATE_LIMIT_RPM = 600;
const RATE_LIMIT_WINDOW_SECONDS = 120;

/**
 * Authenticates Developer Tier programmatic requests using an `ht_dev_` key.
 *
 * The raw key is never stored: the request key is SHA-256 hashed and matched
 * against `users.developer_api_key_hash`. Only active Developer Tier accounts
 * may use a key, and each key is limited to 600 requests per minute, matching
 * the published Developer Tier limit.
 *
 * When this guard succeeds it sets `request.developerApiKeyAuthenticated` so
 * the following SupabaseAuthGuard can skip JWT verification for this request.
 */
@Injectable()
export class DeveloperApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(DeveloperApiKeyGuard.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      return true;
    }

    if (!DEVELOPER_API_KEY_PATTERN.test(apiKey)) {
      throw new UnauthorizedException('Invalid developer API key');
    }

    const digest = createHash('sha256').update(apiKey).digest('hex');
    await this.enforceRateLimit(digest);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('id, is_vip, vip_tier')
      .eq('developer_api_key_hash', digest)
      .single();

    if (error || !data) {
      throw new UnauthorizedException('Invalid developer API key');
    }

    if (!data.is_vip || !(data.vip_tier ?? '').startsWith('developer')) {
      throw new ForbiddenException('Developer subscription required');
    }

    const principal: User = {
      id: data.id,
      app_metadata: {},
      user_metadata: {},
      aud: 'developer_api_key',
      created_at: new Date(0).toISOString(),
    };

    request.user = principal;
    request.developerApiKeyAuthenticated = true;
    return true;
  }

  private extractApiKey(request: AuthenticatedRequest): string | undefined {
    const headerKey = request.headers['x-api-key'];
    const candidate =
      typeof headerKey === 'string'
        ? headerKey
        : Array.isArray(headerKey)
          ? headerKey[0]
          : undefined;
    if (candidate?.trim()) {
      return candidate.trim();
    }

    const authorization = request.headers.authorization;
    if (typeof authorization !== 'string') {
      return undefined;
    }

    const match = /^\s*Bearer[\t ]+(ht_dev_[^\s]+)\s*$/i.exec(authorization);
    return match?.[1];
  }

  private async enforceRateLimit(digest: string): Promise<void> {
    const window = Math.floor(Date.now() / 60000);
    const key = `developer:api-rate:${digest}:${window}`;

    try {
      const redis = this.supabaseService.getRedisClient();
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
      }
      if (count > DEVELOPER_RATE_LIMIT_RPM) {
        const retryAfter = RATE_LIMIT_WINDOW_SECONDS;
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Developer API rate limit exceeded (${DEVELOPER_RATE_LIMIT_RPM} RPM)`,
            retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.warn(
        'Developer API rate limiter unavailable; allowing request through',
      );
    }
  }
}
