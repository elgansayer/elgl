import { HttpService } from '@nestjs/axios';
import type { AxiosRequestConfig } from 'axios';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JSDOM } from 'jsdom';
import { firstValueFrom } from 'rxjs';
import { sanitiseHtml } from '../common/pipes/sanitise-html.pipe';
import { SupabaseService } from '../supabase/supabase.service';
import { LinkPreview } from './interfaces/link-preview.interface';
import { ssrfSafeLookup } from './ssrf-guard';

const CACHE_TTL_SECONDS = 3600;
const FETCH_TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const USER_AGENT =
  'HelloTalkLinkPreviewBot/1.0 (+https://hellotalk.example; scrapes OpenGraph tags for chat link previews)';

@Injectable()
export class LinkPreviewService {
  private readonly logger = new Logger(LinkPreviewService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async getPreview(rawUrl: string): Promise<LinkPreview> {
    const url = this.parseUrl(rawUrl);
    const cacheKey = `link_preview:${url.toString()}`;

    const cached = await this.readCache(cacheKey);
    if (cached) return cached;

    const html = await this.fetchHtml(url);
    const preview = this.extractPreview(html, url);

    await this.writeCache(cacheKey, preview);
    return preview;
  }

  private parseUrl(rawUrl: string): URL {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new BadRequestException('Invalid URL');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BadRequestException('Only http/https URLs are supported');
    }
    if (url.username || url.password) {
      throw new BadRequestException(
        'URLs with embedded credentials are not supported',
      );
    }
    if (url.port && url.port !== '80' && url.port !== '443') {
      throw new BadRequestException(
        'Only default HTTP/HTTPS ports are supported',
      );
    }

    return url;
  }

  private async fetchHtml(url: URL): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<string>(url.toString(), {
          timeout: FETCH_TIMEOUT_MS,
          maxRedirects: 3,
          maxContentLength: MAX_RESPONSE_BYTES,
          responseType: 'text',
          // Pins every redirect hop to a DNS-validated, non-private address.
          // Cast needed because axios's `lookup` typing doesn't match the
          // plain `dns.lookup` callback contract Node's http agent actually
          // calls it with.
          lookup: ssrfSafeLookup as AxiosRequestConfig['lookup'],
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html,application/xhtml+xml',
          },
          validateStatus: (status) => status >= 200 && status < 300,
        }),
      );

      const contentType = String(response.headers['content-type'] ?? '');
      if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
        throw new BadRequestException('URL does not point to a web page');
      }

      return response.data;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(
        `Failed to fetch link preview for ${url.hostname}: ${(err as Error).message}`,
      );
      throw new BadRequestException('Could not fetch a preview for that link');
    }
  }

  private extractPreview(html: string, pageUrl: URL): LinkPreview {
    const dom = new JSDOM(html, { url: pageUrl.toString() });
    const doc = dom.window.document;

    const getMeta = (name: string): string | undefined => {
      const el =
        doc.querySelector(`meta[property="${name}"]`) ??
        doc.querySelector(`meta[name="${name}"]`);
      const content = el?.getAttribute('content')?.trim();
      return content ? content : undefined;
    };

    const rawTitle =
      getMeta('og:title') ??
      doc.querySelector('title')?.textContent?.trim() ??
      pageUrl.hostname;
    const rawDescription = getMeta('og:description') ?? getMeta('description');
    const rawImage = getMeta('og:image') ?? getMeta('og:image:url');
    const rawSiteName = getMeta('og:site_name') ?? pageUrl.hostname;

    return {
      url: pageUrl.toString(),
      title: sanitiseHtml(rawTitle).slice(0, 200),
      description: rawDescription
        ? sanitiseHtml(rawDescription).slice(0, 400)
        : undefined,
      imageUrl: this.resolveImageUrl(rawImage, pageUrl),
      siteName: sanitiseHtml(rawSiteName).slice(0, 100),
    };
  }

  private resolveImageUrl(
    rawImage: string | undefined,
    pageUrl: URL,
  ): string | undefined {
    if (!rawImage) return undefined;
    try {
      const resolved = new URL(rawImage, pageUrl);
      return resolved.protocol === 'http:' || resolved.protocol === 'https:'
        ? resolved.toString()
        : undefined;
    } catch {
      return undefined;
    }
  }

  private async readCache(cacheKey: string): Promise<LinkPreview | null> {
    try {
      const redis = this.supabaseService.getRedisClient();
      const cached = await redis.get(cacheKey);
      return cached ? (JSON.parse(cached) as LinkPreview) : null;
    } catch {
      return null; // Redis unavailable - fall through to a live fetch
    }
  }

  private async writeCache(
    cacheKey: string,
    preview: LinkPreview,
  ): Promise<void> {
    try {
      const redis = this.supabaseService.getRedisClient();
      await redis.set(
        cacheKey,
        JSON.stringify(preview),
        'EX',
        CACHE_TTL_SECONDS,
      );
    } catch {
      // Best-effort cache only
    }
  }
}
