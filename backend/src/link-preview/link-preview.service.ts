import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import * as dns from 'dns';
import * as http from 'http';
import * as https from 'https';
import { createHash } from 'crypto';
import { LinkPreview } from './interfaces/link-preview.interface';
import { isPrivateIp } from './ip-guard';
import Redis from 'ioredis';

/**
 * Maximum accepted HTML document size (bytes) for a scraped page. Pages larger
 * than this are rejected so a malicious site cannot exhaust server memory.
 */
const MAX_RESPONSE_BYTES = 5_000_000;
const MAX_URL_LENGTH = 2_048;
const MAX_TITLE_LENGTH = 300;
const MAX_DESCRIPTION_LENGTH = 1_000;
const MAX_SITE_NAME_LENGTH = 200;
const CACHE_TTL_SECONDS = 3_600;
const CACHE_PREFIX = 'link_preview:v2';

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

    const candidates =
      typeof address === 'string'
        ? [address]
        : address.map((candidate) => candidate.address);
    if (candidates.some((candidate) => isPrivateIp(candidate))) {
      callback(
        new Error('SSRF blocked: resolved address is not publicly routable'),
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
    const parsed = this.validateUrl(url);
    const normalizedUrl = parsed.href;
    const cacheKey = this.cacheKey(normalizedUrl);
    const descriptor = this.urlDescriptor(parsed);

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached) as LinkPreview;
        } catch {
          this.logger.warn(`Invalid link-preview cache entry (${descriptor})`);
        }
      }
    } catch {
      // A cache outage must not turn a best-effort preview into a chat failure.
      this.logger.warn(`Link-preview cache read unavailable (${descriptor})`);
    }

    try {
      const preview = await this.fetchPreview(normalizedUrl);
      if (preview) {
        try {
          await this.redis.set(
            cacheKey,
            JSON.stringify(preview),
            'EX',
            CACHE_TTL_SECONDS,
          );
        } catch {
          // The preview is still valid when Redis is unavailable.
          this.logger.warn(
            `Link-preview cache write unavailable (${descriptor})`,
          );
        }
      }
      return preview;
    } catch (error: unknown) {
      this.logger.error(
        `Link-preview fetch failed (${descriptor}; ${this.errorKind(error)})`,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Unable to fetch preview for this URL');
    }
  }

  private validateUrl(raw: string): URL {
    if (raw.length > MAX_URL_LENGTH) {
      throw new BadRequestException('URL is too long');
    }

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new BadRequestException('Malformed URL');
    }

    this.validateExternalUrl(parsed);
    return parsed;
  }

  private validateExternalUrl(parsed: URL): void {
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
      const isDefaultPort =
        (protocol === 'http:' && parsed.port === '80') ||
        (protocol === 'https:' && parsed.port === '443');
      if (!isDefaultPort) {
        throw new BadRequestException('Custom ports are not allowed');
      }
    }

    if (this.isUnsafeLiteralHost(parsed.hostname)) {
      throw new BadRequestException('Private network URLs are not allowed');
    }
  }

  private validateRedirectTarget(options: {
    protocol?: unknown;
    hostname?: unknown;
    host?: unknown;
    port?: unknown;
    auth?: unknown;
  }): void {
    if (options.auth) {
      throw new BadRequestException(
        'Redirect targets with embedded credentials are not allowed',
      );
    }

    const protocol =
      typeof options.protocol === 'string' ? options.protocol : '';
    const hostname =
      typeof options.hostname === 'string' ? options.hostname : '';
    const host = typeof options.host === 'string' ? options.host : '';

    if (!protocol || (!hostname && !host)) {
      throw new BadRequestException('Invalid redirect target');
    }

    let authority = host;
    if (hostname) {
      const normalizedHostname =
        hostname.includes(':') && !hostname.startsWith('[')
          ? `[${hostname}]`
          : hostname;
      const port =
        options.port === undefined ||
        options.port === null ||
        options.port === ''
          ? ''
          : `:${String(options.port)}`;
      authority = `${normalizedHostname}${port}`;
    }

    let parsed: URL;
    try {
      parsed = new URL(`${protocol}//${authority}/`);
    } catch {
      throw new BadRequestException('Invalid redirect target');
    }

    this.validateExternalUrl(parsed);
  }

  private async fetchPreview(url: string): Promise<LinkPreview | null> {
    const response = await firstValueFrom(
      this.httpService.get<string>(url, {
        timeout: 5000,
        maxRedirects: 3,
        beforeRedirect: (options) => this.validateRedirectTarget(options),
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

    // Remove script/style/noscript content so it does not pollute textual fields.
    $('script, style, noscript').remove();

    const rawTitle =
      this.getMetaTag($, 'og:title') || $('title').text().trim() || '';
    const rawDescription =
      this.getMetaTag($, 'og:description') ||
      this.getMetaTag($, 'description') ||
      '';

    const title = this.sanitizeMetaContent(rawTitle, MAX_TITLE_LENGTH);
    const description = this.sanitizeMetaContent(
      rawDescription,
      MAX_DESCRIPTION_LENGTH,
    );
    const image = this.sanitizeImageUrl(
      this.getMetaTag($, 'og:image') || '',
      url,
    );
    const siteName = this.sanitizeMetaContent(
      this.getMetaTag($, 'og:site_name') || new URL(url).hostname,
      MAX_SITE_NAME_LENGTH,
    );

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

  private sanitizeMetaContent(raw: string, maxLength: number): string {
    const sanitized = this.dompurify.sanitize(raw, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
    const $inner = cheerio.load(`<div>${sanitized}</div>`);
    const text = $inner('div').text().trim();
    return text.length > maxLength ? text.slice(0, maxLength) : text;
  }

  private sanitizeImageUrl(raw: string, pageUrl: string): string {
    if (!raw || raw.length > MAX_URL_LENGTH) {
      return '';
    }

    try {
      const parsed = new URL(raw, pageUrl);
      if (parsed.href.length > MAX_URL_LENGTH) {
        return '';
      }
      this.validateExternalUrl(parsed);
      return parsed.href;
    } catch {
      return '';
    }
  }

  private isUnsafeLiteralHost(hostname: string): boolean {
    const normalized = hostname
      .toLowerCase()
      .replace(/^\[/, '')
      .replace(/\]$/, '');
    return (
      normalized === 'localhost' ||
      normalized.endsWith('.localhost') ||
      isPrivateIp(normalized)
    );
  }

  private cacheKey(url: string): string {
    const digest = createHash('sha256').update(url).digest('hex');
    return `${CACHE_PREFIX}:${digest}`;
  }

  private urlDescriptor(url: URL): string {
    const fingerprint = createHash('sha256')
      .update(url.href)
      .digest('hex')
      .slice(0, 12);
    return `${url.hostname}#${fingerprint}`;
  }

  private errorKind(error: unknown): string {
    return error instanceof Error ? error.name : 'UnknownError';
  }
}
