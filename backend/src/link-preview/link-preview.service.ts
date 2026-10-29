import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout } from 'rxjs';
import * as cheerio from 'cheerio';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import * as dns from 'dns';
import * as http from 'http';
import * as https from 'https';
import { createHash } from 'crypto';
import { MetricsService } from '../metrics/metrics.service';
import { LinkPreview } from './interfaces/link-preview.interface';
import {
  classifyLinkPreviewFailure,
  LinkPreviewFailure,
  type LinkPreviewFailureReason,
} from './link-preview-diagnostics';
import { isPrivateIp } from './ip-guard';
import type Redis from 'ioredis';

/**
 * Maximum accepted HTML document size (bytes) for a scraped page. Pages larger
 * than this are rejected so a malicious site cannot exhaust server memory.
 */
const MAX_RESPONSE_BYTES = 5_000_000;
/**
 * axios applies this to each request hop: it bounds connecting and waiting for
 * response headers, then becomes an idle timer that every received byte resets.
 */
const SOCKET_TIMEOUT_MS = 5_000;
/**
 * Hard wall-clock ceiling for one origin scrape, redirects and body included.
 * Without it a server that sends headers and then drips the body just inside
 * the idle timer holds the request, and the chat send awaiting it, open
 * indefinitely.
 */
const FETCH_DEADLINE_MS = 8_000;
const MAX_URL_LENGTH = 2_048;
const MAX_TITLE_LENGTH = 300;
const MAX_DESCRIPTION_LENGTH = 1_000;
const MAX_SITE_NAME_LENGTH = 200;
const MAX_CACHE_ENTRY_BYTES = 16_384;
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
        new LinkPreviewFailure(
          'SSRF blocked: resolved address is not publicly routable',
          'blocked_target',
        ),
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
  private readonly metrics: MetricsService;

  constructor(
    httpService: HttpService,
    @Inject('REDIS_CLIENT') redis: Redis,
    metrics: MetricsService,
  ) {
    this.httpService = httpService;
    this.redis = redis;
    this.metrics = metrics;
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
    let parsed: URL;
    try {
      parsed = this.validateUrl(url);
    } catch (error: unknown) {
      this.metrics.recordLinkPreview('rejected', {
        reason: classifyLinkPreviewFailure(error),
      });
      throw error;
    }
    const normalizedUrl = parsed.href;
    const cacheKey = this.cacheKey(normalizedUrl);
    const descriptor = this.urlDescriptor(parsed);

    let cachedPreview: LinkPreview | null = null;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        cachedPreview = this.parseCachedPreview(cached, normalizedUrl);
        if (!cachedPreview) {
          this.logger.warn(`Invalid link-preview cache entry (${descriptor})`);
        }
      }
    } catch {
      // A cache outage must not turn a best-effort preview into a chat failure.
      this.logger.warn(`Link-preview cache read unavailable (${descriptor})`);
    }
    if (cachedPreview) {
      this.metrics.recordLinkPreview('cache_hit');
      return cachedPreview;
    }

    const startedAt = performance.now();
    let preview: LinkPreview | null;
    try {
      preview = await this.fetchPreview(normalizedUrl);
    } catch (error: unknown) {
      const reason = classifyLinkPreviewFailure(error);
      this.metrics.recordLinkPreview('failed', {
        reason,
        durationSeconds: this.secondsSince(startedAt),
      });
      this.logFetchFailure(descriptor, reason, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Unable to fetch preview for this URL');
    }

    this.metrics.recordLinkPreview(preview ? 'fetched' : 'empty', {
      durationSeconds: this.secondsSince(startedAt),
    });
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
  }

  private validateUrl(raw: string): URL {
    if (raw.length > MAX_URL_LENGTH) {
      throw new LinkPreviewFailure('URL is too long', 'invalid_url');
    }

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new LinkPreviewFailure('Malformed URL', 'invalid_url');
    }

    this.validateExternalUrl(parsed, 'invalid_url');
    return parsed;
  }

  /**
   * @param malformedReason reason reported for a protocol or credential
   * violation. Redirect targets report these as blocked rather than invalid,
   * because the caller did not choose them.
   */
  private validateExternalUrl(
    parsed: URL,
    malformedReason: LinkPreviewFailureReason,
  ): void {
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      throw new LinkPreviewFailure(
        'Only http and https protocols are allowed',
        malformedReason,
      );
    }

    if (!parsed.hostname) {
      throw new BadRequestException('Hostname is required');
    }

    if (parsed.username || parsed.password) {
      throw new LinkPreviewFailure(
        'Embedded credentials are not allowed',
        malformedReason,
      );
    }

    if (parsed.port) {
      const isDefaultPort =
        (protocol === 'http:' && parsed.port === '80') ||
        (protocol === 'https:' && parsed.port === '443');
      if (!isDefaultPort) {
        throw new LinkPreviewFailure(
          'Custom ports are not allowed',
          'blocked_target',
        );
      }
    }

    if (this.isUnsafeLiteralHost(parsed.hostname)) {
      throw new LinkPreviewFailure(
        'Private network URLs are not allowed',
        'blocked_target',
      );
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
      throw new LinkPreviewFailure(
        'Redirect targets with embedded credentials are not allowed',
        'blocked_target',
      );
    }

    const protocol =
      typeof options.protocol === 'string' ? options.protocol : '';
    const hostname =
      typeof options.hostname === 'string' ? options.hostname : '';
    const host = typeof options.host === 'string' ? options.host : '';

    if (!protocol || (!hostname && !host)) {
      throw new LinkPreviewFailure('Invalid redirect target', 'blocked_target');
    }

    let authority = host;
    if (hostname) {
      const normalizedHostname =
        hostname.includes(':') && !hostname.startsWith('[')
          ? `[${hostname}]`
          : hostname;
      const rawPort = options.port;
      if (
        rawPort !== undefined &&
        rawPort !== null &&
        typeof rawPort !== 'string' &&
        typeof rawPort !== 'number'
      ) {
        throw new LinkPreviewFailure(
          'Invalid redirect target',
          'blocked_target',
        );
      }
      const port =
        rawPort === undefined || rawPort === null || rawPort === ''
          ? ''
          : ':' + rawPort;
      authority = `${normalizedHostname}${port}`;
    }

    let parsed: URL;
    try {
      parsed = new URL(`${protocol}//${authority}/`);
    } catch {
      throw new LinkPreviewFailure('Invalid redirect target', 'blocked_target');
    }

    this.validateExternalUrl(parsed, 'blocked_target');
  }

  private async fetchPreview(url: string): Promise<LinkPreview | null> {
    const response = await firstValueFrom(
      this.httpService
        .get<string>(url, {
          timeout: SOCKET_TIMEOUT_MS,
          maxRedirects: 3,
          beforeRedirect: (options) => this.validateRedirectTarget(options),
          httpAgent,
          httpsAgent,
          // Keep the body a string so axios never JSON-parses a page that
          // merely happens to look like JSON.
          responseType: 'text',
          maxContentLength: MAX_RESPONSE_BYTES,
          maxBodyLength: MAX_RESPONSE_BYTES,
        })
        // Unsubscribing on expiry makes HttpService cancel the request and
        // destroy its socket, so a slow-drip origin cannot hold either open.
        .pipe(timeout(FETCH_DEADLINE_MS)),
    );

    const rawContentType =
      (response.headers as Record<string, string | string[] | undefined>)[
        'content-type'
      ] ?? '';
    const contentType: string = (
      Array.isArray(rawContentType)
        ? rawContentType.join(';')
        : typeof rawContentType === 'string'
          ? rawContentType
          : ''
    ).toLowerCase();
    if (
      !contentType.includes('text/html') &&
      !contentType.includes('application/xhtml+xml')
    ) {
      throw new LinkPreviewFailure(
        'URL does not point to an HTML resource',
        'not_html',
      );
    }

    const html = response.data ?? '';
    const $ = cheerio.load(html);

    // Remove script/style/noscript content so it does not pollute textual fields.
    $('script, style, noscript').remove();

    // The document title is the first <title>. Later ones belong to inline SVG
    // icons, whose accessible names would otherwise be appended to the title.
    const rawTitle =
      this.getMetaTag($, 'og:title') ||
      this.getMetaTag($, 'twitter:title') ||
      $('title').first().text().trim() ||
      '';
    const rawDescription =
      this.getMetaTag($, 'og:description') ||
      this.getMetaTag($, 'twitter:description') ||
      this.getMetaTag($, 'description') ||
      '';

    const title = this.sanitiseMetaContent(rawTitle, MAX_TITLE_LENGTH);
    const description = this.sanitiseMetaContent(
      rawDescription,
      MAX_DESCRIPTION_LENGTH,
    );
    const rawImage =
      this.getMetaTag($, 'og:image') ||
      this.getMetaTag($, 'og:image:url') ||
      this.getMetaTag($, 'og:image:secure_url') ||
      this.getMetaTag($, 'twitter:image') ||
      this.getMetaTag($, 'twitter:image:src') ||
      '';
    const image = this.sanitiseImageUrl(rawImage, url);
    const siteName = this.sanitiseMetaContent(
      this.getMetaTag($, 'og:site_name') ||
        this.getMetaTag($, 'twitter:site') ||
        new URL(url).hostname,
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

  private sanitiseMetaContent(raw: string, maxLength: number): string {
    const sanitized = this.dompurify.sanitize(raw, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
    const $inner = cheerio.load(`<div>${sanitized}</div>`);
    const text = $inner('div').text().trim();
    return text.length > maxLength ? text.slice(0, maxLength) : text;
  }

  private sanitizeMetaContent(raw: string, maxLength: number): string {
    return this.sanitiseMetaContent(raw, maxLength);
  }

  private sanitiseImageUrl(raw: string, pageUrl: string): string {
    if (!raw || raw.length > MAX_URL_LENGTH) {
      return '';
    }

    try {
      const parsed = new URL(raw, pageUrl);
      if (parsed.href.length > MAX_URL_LENGTH) {
        return '';
      }
      this.validateExternalUrl(parsed, 'invalid_url');
      return parsed.href;
    } catch {
      return '';
    }
  }

  private sanitizeImageUrl(raw: string, pageUrl: string): string {
    return this.sanitiseImageUrl(raw, pageUrl);
  }

  private parseCachedPreview(
    cached: string,
    requestedUrl: string,
  ): LinkPreview | null {
    if (Buffer.byteLength(cached, 'utf8') > MAX_CACHE_ENTRY_BYTES) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cached) as unknown;
    } catch {
      return null;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const candidate = parsed as Record<string, unknown>;
    if (candidate['url'] !== requestedUrl) {
      return null;
    }

    const title = this.sanitiseMetaContent(
      typeof candidate['title'] === 'string' ? candidate['title'] : '',
      MAX_TITLE_LENGTH,
    );
    const description = this.sanitiseMetaContent(
      typeof candidate['description'] === 'string'
        ? candidate['description']
        : '',
      MAX_DESCRIPTION_LENGTH,
    );
    const image = this.sanitiseImageUrl(
      typeof candidate['image'] === 'string' ? candidate['image'] : '',
      requestedUrl,
    );
    const siteName = this.sanitiseMetaContent(
      typeof candidate['siteName'] === 'string' && candidate['siteName']
        ? candidate['siteName']
        : new URL(requestedUrl).hostname,
      MAX_SITE_NAME_LENGTH,
    );

    if (!title && !description && !image) {
      return null;
    }

    return {
      url: requestedUrl,
      title,
      description,
      image,
      siteName,
    };
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

  private secondsSince(startedAt: number): number {
    return (performance.now() - startedAt) / 1_000;
  }

  /**
   * Origin-caused failures (dead links, blocked targets, slow or non-HTML
   * pages) are routine for user-supplied URLs, so only an unclassified failure
   * is logged as an error. The classified reason is also exported as a metric.
   */
  private logFetchFailure(
    descriptor: string,
    reason: LinkPreviewFailureReason,
    error: unknown,
  ): void {
    const message = `Link-preview fetch failed (${descriptor}; reason=${reason}; ${this.errorKind(error)})`;
    if (reason === 'unknown') {
      this.logger.error(message);
      return;
    }
    this.logger.warn(message);
  }
}
