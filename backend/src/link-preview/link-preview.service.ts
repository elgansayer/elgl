/* eslint-disable @typescript-eslint/no-unsafe-assignment,
                  @typescript-eslint/no-unsafe-call,
                  @typescript-eslint/no-unsafe-member-access,
                  @typescript-eslint/no-unsafe-return */

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import { LinkPreview } from './interfaces/link-preview.interface';

@Injectable()
export class LinkPreviewService {
  private readonly logger = new Logger(LinkPreviewService.name);

  constructor(private readonly httpService: HttpService) {}

  async fetchPreview(url: string): Promise<LinkPreview | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { timeout: 5000, maxRedirects: 3 }),
      );
      const html = response.data;
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
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to fetch link preview for ${url}: ${message}`,
      );
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
