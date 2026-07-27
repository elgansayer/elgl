/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import { LinkPreview } from './interfaces/link-preview.interface';
import Redis from 'ioredis';

@Injectable()
export class LinkPreviewService {
  private readonly logger = new Logger(LinkPreviewService.name);

  constructor(
    private readonly httpService: HttpService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async getPreview(url: string): Promise<LinkPreview | null> {
    this.validateUrl(url);

    const cacheKey = `linkPreview:${url}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as LinkPreview;
      } catch {
        this.logger.warn(`Invalid link-preview cache entry for ${url}`);
      }
    }

    const preview = await this.fetchPreview(url);
    if (preview) {
      await this.redis.set(cacheKey, JSON.stringify(preview), 'EX', 3600);
    }
    return preview;
  }

  private validateUrl(raw: string): void {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new BadRequestException('Malformed URL');
    }

    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      throw new BadRequestException('Only http and https protocols are allowed');
    }

    if (parsed.username || parsed.password) {
      throw new BadRequestException('Embedded credentials are not allowed');
    }

    if (parsed.port) {
      if (protocol === 'http:' && parsed.port === '80') {
        return;
      }
      if (protocol === 'https:' && parsed.port === '443') {
        return;
      }
      throw new BadRequestException('Custom ports are not allowed');
    }
  }

  private async fetchPreview(url: string): Promise<LinkPreview | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { timeout: 5000, maxRedirects: 3 }),
      );
      const html = (response.data ?? '') as string;
      const $ = cheerio.load(html);

      const title =
        this.getMetaTag($, 'og:title') || $('title').text().trim() || '';
      const description =
        this.getMetaTag($, 'og:description') ||
        this.getMetaTag($, 'description') ||
        '';
      const image = this.getMetaTag($, 'og:image') || '';
      const siteName = this.getMetaTag($, 'og:site_name') || '';

      if (!title && !description && !image) {
        return null;
      }

      return {
        url,
        title,
        description,
        image,
        siteName,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch link preview for ${url}: ${message}`);
      return null;
    }
  }

  private getMetaTag($: cheerio.CheerioAPI, property: string): string {
    return (
      $(`meta[property="${property}"]`).attr('content') ||
      $(`meta[name="${property}"]`).attr('content') ||
      ''
    ).trim();
  }
}
