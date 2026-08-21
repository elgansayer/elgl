import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

/**
 * Service for targeted Cloudflare edge cache invalidation via the Cloudflare API.
 *
 * Uses Cache-Tag-based purging so that mutations to user-specific resources
 * can invalidate only the affected user's cached endpoints without wiping
 * the entire zone or the entire cache for a path.
 *
 * Environment variables required:
 *   CLOUDFLARE_API_TOKEN   -- scoped API token with Cache Purge permission
 *   CLOUDFLARE_ZONE_ID     -- Cloudflare Zone ID for your domain
 */
@Injectable()
export class CloudflareCacheService {
  private readonly apiToken: string;
  private readonly zoneId: string;
  private readonly apiBase: string;

  constructor(
    @InjectPinoLogger(CloudflareCacheService.name)
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
  ) {
    this.apiToken =
      this.configService.get<string>('CLOUDFLARE_API_TOKEN') ?? '';
    this.zoneId = this.configService.get<string>('CLOUDFLARE_ZONE_ID') ?? '';
    this.apiBase = `https://api.cloudflare.com/client/v4/zones/${this.zoneId}`;
  }

  /**
   * Purges cached content by Cache-Tag values.
   *
   * Cloudflare recommends Cache-Tag purging over URL-based purging because
   * it allows fine-grained invalidation of specific user data without
   * affecting other users or endpoints.
   *
   * @param tags -- one or more Cache-Tag values to purge (e.g. ['flashcards:user1', 'flashcards:due:user1'])
   * @returns true if at least one tag was purged successfully
   */
  async purgeByCacheTags(tags: string[]): Promise<boolean> {
    if (!this.apiToken || !this.zoneId) {
      this.logger.debug(
        { tags },
        'Cloudflare cache purging skipped -- API token or Zone ID not configured',
      );
      return false;
    }

    if (!tags || tags.length === 0) {
      return false;
    }

    try {
      const response = await fetch(`${this.apiBase}/purge_cache`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tags }),
      });

      const body = await response.json();

      if (!response.ok || !body.success) {
        const errors = body.errors
          ?.map(
            (e: { code?: string; message?: string }) =>
              `${e.code ?? 'UNKNOWN'}: ${e.message ?? 'Unknown error'}`,
          )
          .join('; ');
        this.logger.warn(
          { tags, status: response.status, errors },
          'Cloudflare cache tag purge returned an error response',
        );
        return false;
      }

      this.logger.info(
        { tags, resultId: body.result?.id },
        'Cloudflare cache tag purge successful',
      );
      return true;
    } catch (err: unknown) {
      this.logger.warn(
        {
          tags,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        'Failed to reach Cloudflare API for cache tag purge',
      );
      return false;
    }
  }
}
