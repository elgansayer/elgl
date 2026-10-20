import {
  Injectable,
  Logger,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import * as dns from 'dns';
import * as http from 'http';
import * as https from 'https';
import { LinkPreview } from './interfaces/link-preview.interface';
import { isPrivateIp } from './ip-guard';
import Redis from 'ioredis';

/**
 * Maximum accepted HTML document size (bytes) for a scraped page. Pages larger
 * than this are rejected so a malicious site cannot exhaust server memory.
 */
const MAX_RESPONSE_BYTES = 5_000_000;

const safeLookup = (
  hostname: string,
  options: dns.LookupOptions | number,
  callback: (
    err: NodeJS.ErrnoException | null,
    address: string | dns.LookupAddress[],
    family: number,
  ) => void,
): void => {
  const lookupOptions: dns.LookupOptions =
    typeof options === 'number' ? { family: options } : options;

  dns.lookup(hostname, lookupOptions, (err, address, family) => {
    if (err) {
      callback(err, address, family);
      return;
    }

    const candidate =
      typeof address === 'string' ? address : address[0]?.address;
    if (candidate && isPrivateIp(candidate)) {
      callback(
        new Error(`SSRF blocked: Private IP ${candidate} is not allowed.`),
        address,
        family,
      );
      return;
    }
    callback(null, address, family);
  });
};

const httpAgent = new http.Agent({ lookup: safeLookup });
const httpsAgent = new https.Agent({ lookup: safeLookup });

@Injectable()
export class LinkPreviewService {
  private readonly logger = new Logger(LinkPreviewService.name);
  private readonly dompurify: ReturnType<typeof DOMPurify>;
  private readonly httpService: HttpService;
  private readonly redis: Redis;

  constructor(httpService: HttpService, @Inject('REDIS_CLIENT') redis: Redis) {
    this.httpService = httpService;
    this.redis = redis;
    const window = new JSDOM('').window;
    this.dompurify = DOMPurify(window);
    this.dompurify.setConfig({
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      ALLOW_DATA_ATTR: false,
      ALLOWED_URI_REGEXP: /^(?!(?:javascript|data):)/i,
    });
  }

  async getPreview(url: string): Promise<LinkPreview | null> {
    this.validateUrl(url);

    const cacheKey = `link_preview:${url}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as LinkPreview;
      } catch {
        this.logger.warn(`Invalid link-preview cache entry for ${url}`);
      }
    }

    try {
      const preview = await this.fetchPreview(url);
      if (preview) {
        await this.redis.set(cacheKey, JSON.stringify(preview), 'EX', 3600);
      }
      return preview;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch link preview for ${url}: ${message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Unable to fetch preview for this URL');
    }
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
      throw new BadRequestException(
        'Only http and https protocols are allowed',
      );
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
    const response = await firstValueFrom(
      this.httpService.get<string>(url, {
        timeout: 5000,
        maxRedirects: 3,
        httpAgent,
        httpsAgent,
        maxContentLength: MAX_RESPONSE_BYTES,
        maxBodyLength: MAX_RESPONSE_BYTES,
      }),
    );

    const rawContentType =
      (response.headers as Record<string, string>)['content-type'] ?? '';
    const contentType: string = rawContentType.toLowerCase();
    if (!contentType.includes('text/html')) {
      throw new BadRequestException('URL does not point to an HTML resource');
    }

    const html = response.data ?? '';
    const $ = cheerio.load(html);

    // Remove script/style/noscript content so it does not pollute textual fields
    $('script, style, noscript').remove();

    const rawTitle =
      this.getMetaTag($, 'og:title') || $('title').text().trim() || '';
    const rawDescription =
      this.getMetaTag($, 'og:description') ||
      this.getMetaTag($, 'description') ||
      '';

    const title = this.sanitizeMetaContent(rawTitle);
    const description = this.sanitizeMetaContent(rawDescription);

    let image = this.getMetaTag($, 'og:image') || '';
    if (image) {
      try {
        image = new URL(image, url).href;
      } catch {
        image = '';
      }
    }

    const siteName =
      this.getMetaTag($, 'og:site_name') || new URL(url).hostname;

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
  }

  private getMetaTag($: cheerio.CheerioAPI, property: string): string {
    return (
      $(`meta[property="${property}"]`).attr('content') ||
      $(`meta[name="${property}"]`).attr('content') ||
      ''
    ).trim();
  }

  private sanitizeMetaContent(raw: string): string {
    const sanitized = this.dompurify.sanitize(raw, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
    const $inner = cheerio.load(`<div>${sanitized}</div>`);
    return $inner('div').text().trim();
  }
}
