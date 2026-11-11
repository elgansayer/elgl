import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { R2ObjectService } from '../cloudflare-r2/r2-object.service';
import { R2GatewayError } from '../cloudflare-r2/r2.service';
import { DMCA_QUARANTINE_PREFIX } from './dmca.constants';
import { keyFromPublicUrl } from './dmca-policy';

/** One hosted file referenced by disabled content. */
export interface DmcaMediaObject {
  url: string;
  key: string;
  quarantineKey: string;
  contentType: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNotFound(error: unknown): boolean {
  return error instanceof R2GatewayError && error.status === 404;
}

/**
 * Moves the files behind disabled content out of public reach and back again.
 * Blanking the database row stops the app serving the material, but the public
 * file URL the claimant quoted would still work, so hosted files are copied to
 * a private prefix and removed. Every step is safe to repeat: a missing source
 * means the move already happened, and an interrupted move is redone from the
 * start.
 */
@Injectable()
export class DmcaMediaService {
  private readonly logger = new Logger(DmcaMediaService.name);

  constructor(
    private readonly objects: R2ObjectService,
    private readonly configService: ConfigService,
  ) {}

  /** Files we host among the references of one item, with fixed quarantine keys. */
  plan(
    targetType: string,
    targetId: string,
    urls: string[],
  ): DmcaMediaObject[] {
    const base = this.configService.get<string>('CLOUDFLARE_R2_PUBLIC_URL');
    if (!base) return [];

    const planned: DmcaMediaObject[] = [];
    const seen = new Set<string>();
    for (const url of urls) {
      const key = keyFromPublicUrl(url, base);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      planned.push({
        url,
        key,
        quarantineKey: `${DMCA_QUARANTINE_PREFIX}/${targetType}/${targetId}/${planned.length}`,
        contentType: null,
      });
    }
    return planned;
  }

  /** Reads the stored JSON back into typed objects, dropping malformed entries. */
  parse(value: unknown): DmcaMediaObject[] {
    if (!Array.isArray(value)) return [];
    const entries: readonly unknown[] = value;
    const parsed: DmcaMediaObject[] = [];
    for (const entry of entries) {
      if (
        isRecord(entry) &&
        typeof entry['url'] === 'string' &&
        typeof entry['key'] === 'string' &&
        typeof entry['quarantineKey'] === 'string' &&
        entry['quarantineKey'].startsWith(`${DMCA_QUARANTINE_PREFIX}/`)
      ) {
        parsed.push({
          url: entry['url'],
          key: entry['key'],
          quarantineKey: entry['quarantineKey'],
          contentType:
            typeof entry['contentType'] === 'string'
              ? entry['contentType']
              : null,
        });
      }
    }
    return parsed;
  }

  async quarantine(
    objects: DmcaMediaObject[],
  ): Promise<{ objects: DmcaMediaObject[]; failed: number }> {
    const result: DmcaMediaObject[] = [];
    let failed = 0;

    for (const object of objects) {
      try {
        const downloaded = await this.objects.downloadObject(object.key);
        await this.objects.uploadBytes(
          object.quarantineKey,
          downloaded.contentType,
          downloaded.bytes,
        );
        await this.objects.deleteObject(object.key);
        result.push({ ...object, contentType: downloaded.contentType });
      } catch (error) {
        if (isNotFound(error)) {
          // Already moved on an earlier attempt, or the file never existed.
          result.push(object);
          continue;
        }
        failed += 1;
        result.push(object);
        this.logger.error('dmca_media_quarantine_failed');
      }
    }
    return { objects: result, failed };
  }

  async restore(objects: DmcaMediaObject[]): Promise<{ failed: number }> {
    let failed = 0;

    for (const object of objects) {
      try {
        const downloaded = await this.objects.downloadObject(
          object.quarantineKey,
        );
        await this.objects.uploadBytes(
          object.key,
          object.contentType ?? downloaded.contentType,
          downloaded.bytes,
        );
        await this.objects.deleteObject(object.quarantineKey);
      } catch (error) {
        if (isNotFound(error)) continue;
        failed += 1;
        this.logger.error('dmca_media_restore_failed');
      }
    }
    return { failed };
  }

  /** Deletes quarantined copies of content that no longer exists. */
  async discard(objects: DmcaMediaObject[]): Promise<{ failed: number }> {
    let failed = 0;
    for (const object of objects) {
      try {
        await this.objects.deleteObject(object.quarantineKey);
      } catch (error) {
        if (isNotFound(error)) continue;
        failed += 1;
        this.logger.error('dmca_media_discard_failed');
      }
    }
    return { failed };
  }
}
