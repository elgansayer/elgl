import {
  BadRequestException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { isAxiosError } from 'axios';
import * as cheerio from 'cheerio';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import { LinkPreview } from './interfaces/link-preview.interface';
import {
  assertPublicHttpUrl,
  MAX_LINK_PREVIEW_URL_LENGTH,
  parseLinkPreviewUrl,
  UnsafeLinkPreviewUrlError,
} from './link-preview-url';
import {
  BlockedAddressError,
  fetchHtml,
  NotHtmlResponseError,
} from './safe-html-fetch';
import {
  LinkPreviewFetchOutcome,
  LinkPreviewRequestOutcome,
  MetricsService,
} from '../metrics/metrics.service';

const MAX_TITLE_LENGTH = 300;
const MAX_DESCRIPTION_LENGTH = 1_000;
const MAX_SITE_NAME_LENGTH = 200;
const MAX_CACHE_ENTRY_BYTES = 16_384;
const CACHE_TTL_SECONDS = 3_600;
/** How long a failed or empty scrape is remembered so a broken link is not re-fetched on every message. */
const NEGATIVE_CACHE_TTL_SECONDS = 300;
const CACHE_PREFIX = 'link_preview:v2';
const NEGATIVE_CACHE_PREFIX = `${CACHE_PREFIX}:negative`;
/** Origin scrapes allowed at once; beyond this, previews are skipped instead of queued. */
const MAX_CONCURRENT_FETCHES = 20;
const PREVIEW_UNAVAILABLE_MESSAGE = 'Unable to fetch preview for this URL';
/** Raw metadata longer than this many times its output limit is cut before sanitising. */
const RAW_TEXT_BOUND_FACTOR = 4;

const WAIT_TIMED_OUT: unique symbol = Symbol('link-preview-wait-timed-out');

type NegativeKind = 'empty' | 'error';

interface Failure {
  status: 'bad_request' | 'unavailable' | 'timeout';
  message: string;
}

/** What one request resolved to; `failure` is set when the caller should see an error. */
interface Resolution {
  outcome: LinkPreviewRequestOutcome;
  preview: LinkPreview | null;
  failure?: Failure;
}

interface ClassifiedFailure {
  outcome: Exclude<LinkPreviewFetchOutcome, 'fetched' | 'empty'>;
  message: string;
  detail: string;
}

export interface GetPreviewOptions {
  /**
   * Stop waiting for a slow origin after this many milliseconds. The scrape
   * itself keeps running within its own deadline, so a later request for the
   * same URL is answered from the cache.
   */
  maxWaitMs?: number;
}

const TIMEOUT_CODES = new Set([
  'ECONNABORTED',
  'ETIMEDOUT',
  'ERR_CANCELED',
  'ESOCKETTIMEDOUT',
]);
const UPSTREAM_CODES = new Set([
  'ERR_BAD_REQUEST',
  'ERR_BAD_RESPONSE',
  'ERR_FR_TOO_MANY_REDIRECTS',
  'ERR_FR_MAX_BODY_LENGTH_EXCEEDED',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The error and the chain of causes that wrapped it on the way up from the socket. */
function causeChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  let current: unknown = error;
  while (current !== undefined && current !== null && chain.length < 8) {
    chain.push(current);
    current = current instanceof Error ? current.cause : undefined;
  }
  return chain;
}

function charsetOf(contentType: string): string | undefined {
  const match = /charset\s*=\s*["']?([^\s"';]+)/i.exec(contentType);
  return match?.[1];
}

function isInvisibleOrControl(codePoint: number): boolean {
  return (
    codePoint < 0x20 ||
    (codePoint >= 0x7f && codePoint <= 0x9f) ||
    codePoint === 0x200b ||
    codePoint === 0x2060 ||
    codePoint === 0xfeff ||
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    (codePoint >= 0x2066 && codePoint <= 0x2069)
  );
}

/**
 * Collapses whitespace and removes control characters and invisible bidi
 * overrides, which a hostile page could use to reorder or hide card text.
 */
function tidyText(value: string): string {
  let tidy = '';
  for (const character of value.replace(/\s+/gu, ' ')) {
    if (!isInvisibleOrControl(character.codePointAt(0) ?? 0)) {
      tidy += character;
    }
  }
  return tidy.trim();
}

/** Truncates to `maxLength` UTF-16 units without leaving half of a surrogate pair. */
function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  const cut = value.slice(0, maxLength);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

@Injectable()
export class LinkPreviewService {
  private readonly logger = new Logger(LinkPreviewService.name);
  private readonly dompurify: ReturnType<typeof DOMPurify>;
  private readonly httpService: HttpService;
  private readonly redis: Redis;
  private readonly metrics: MetricsService;
  /** One scrape per URL at a time: concurrent requests share the running fetch. */
  private readonly inFlight = new Map<string, Promise<Resolution>>();

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

  async getPreview(
    url: string,
    options: GetPreviewOptions = {},
  ): Promise<LinkPreview | null> {
    let parsed: URL;
    try {
      parsed = parseLinkPreviewUrl(url);
    } catch (error) {
      this.metrics.recordLinkPreviewRequest('invalid_url');
      if (error instanceof UnsafeLinkPreviewUrlError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const resolution = await this.resolve(parsed, options);
    this.metrics.recordLinkPreviewRequest(resolution.outcome);
    if (resolution.failure) {
      throw this.toException(resolution.failure);
    }
    return resolution.preview;
  }

  /**
   * Re-validates a preview that came from storage (the URL cache or the
   * per-message store) against the current output contract. The JSON is
   * untrusted: oversized, malformed, mismatched or unsafe entries yield null so
   * the caller refreshes from the origin or shows no card.
   */
  parseUntrustedPreview(raw: string, expectedUrl: string): LinkPreview | null {
    if (Buffer.byteLength(raw, 'utf8') > MAX_CACHE_ENTRY_BYTES) {
      return null;
    }

    let parsed: unknown;
    let fallbackSiteName: string;
    try {
      parsed = JSON.parse(raw);
      fallbackSiteName = new URL(expectedUrl).hostname;
    } catch {
      return null;
    }

    if (!isRecord(parsed) || parsed['url'] !== expectedUrl) {
      return null;
    }

    const title = this.sanitizeMetaContent(
      typeof parsed['title'] === 'string' ? parsed['title'] : '',
      MAX_TITLE_LENGTH,
    );
    const description = this.sanitizeMetaContent(
      typeof parsed['description'] === 'string' ? parsed['description'] : '',
      MAX_DESCRIPTION_LENGTH,
    );
    const image = this.sanitizeImageUrl(
      typeof parsed['image'] === 'string' ? parsed['image'] : '',
      expectedUrl,
    );
    const siteName = this.sanitizeMetaContent(
      typeof parsed['siteName'] === 'string' && parsed['siteName']
        ? parsed['siteName']
        : fallbackSiteName,
      MAX_SITE_NAME_LENGTH,
    );

    if (!title && !description && !image) {
      return null;
    }

    return { url: expectedUrl, title, description, image, siteName };
  }

  private async resolve(
    parsed: URL,
    options: GetPreviewOptions,
  ): Promise<Resolution> {
    const url = parsed.href;
    const descriptor = this.urlDescriptor(parsed);

    const cached = await this.readCachedPreview(url, descriptor);
    if (cached) {
      return { outcome: 'cache_hit', preview: cached };
    }

    const negative = await this.readNegativeEntry(url, descriptor);
    if (negative) {
      return {
        outcome: 'negative_hit',
        preview: null,
        failure:
          negative === 'error'
            ? { status: 'bad_request', message: PREVIEW_UNAVAILABLE_MESSAGE }
            : undefined,
      };
    }

    const flight = this.inFlight.get(url) ?? this.startScrape(url, descriptor);
    if (options.maxWaitMs === undefined) {
      return flight;
    }

    const settled = await this.waitAtMost(flight, options.maxWaitMs);
    if (settled === WAIT_TIMED_OUT) {
      this.logger.warn(
        `Link-preview wait timed out (${descriptor}; waitedMs=${options.maxWaitMs})`,
      );
      return {
        outcome: 'wait_timeout',
        preview: null,
        failure: { status: 'timeout', message: 'Link preview timed out' },
      };
    }
    return settled;
  }

  private startScrape(url: string, descriptor: string): Promise<Resolution> {
    if (this.inFlight.size >= MAX_CONCURRENT_FETCHES) {
      this.logger.warn(
        `Link-preview scrape skipped, at capacity (${descriptor}; limit=${MAX_CONCURRENT_FETCHES})`,
      );
      return Promise.resolve({
        outcome: 'busy',
        preview: null,
        failure: {
          status: 'unavailable',
          message: 'Link previews are temporarily unavailable',
        },
      });
    }

    const flight = this.scrape(url, descriptor).finally(() => {
      this.inFlight.delete(url);
      this.metrics.setLinkPreviewInflightFetches(this.inFlight.size);
    });
    this.inFlight.set(url, flight);
    this.metrics.setLinkPreviewInflightFetches(this.inFlight.size);
    return flight;
  }

  /** Scrapes the origin once and remembers the result; never rejects. */
  private async scrape(url: string, descriptor: string): Promise<Resolution> {
    const started = Date.now();
    let resolution: Resolution;
    let fetchOutcome: LinkPreviewFetchOutcome;

    try {
      const preview = await this.fetchPreview(url);
      fetchOutcome = preview ? 'fetched' : 'empty';
      resolution = { outcome: fetchOutcome, preview };
    } catch (error) {
      const failure = this.classifyFailure(error);
      fetchOutcome = failure.outcome;
      resolution = {
        outcome: failure.outcome,
        preview: null,
        failure: { status: 'bad_request', message: failure.message },
      };
      this.logger.warn(
        `Link-preview fetch failed (${descriptor}; outcome=${failure.outcome}; ${failure.detail})`,
      );
    }

    this.metrics.observeLinkPreviewFetch(
      fetchOutcome,
      (Date.now() - started) / 1000,
    );
    await this.rememberResolution(url, descriptor, resolution);
    return resolution;
  }

  private async fetchPreview(url: string): Promise<LinkPreview | null> {
    const { body, contentType, finalUrl } = await fetchHtml(
      this.httpService,
      url,
    );

    const $ =
      typeof body === 'string'
        ? cheerio.load(body)
        : cheerio.loadBuffer(body, {
            encoding: {
              transportLayerEncodingLabel: charsetOf(contentType),
              defaultEncoding: 'utf-8',
            },
          });

    // Remove script/style/noscript content so it does not pollute textual fields.
    $('script, style, noscript').remove();

    const rawTitle =
      this.getMetaTag($, 'og:title') ||
      $('head > title').first().text().trim() ||
      $('title').first().text().trim() ||
      '';
    const rawDescription =
      this.getMetaTag($, 'og:description') ||
      this.getMetaTag($, 'description') ||
      '';

    const title = this.sanitizeMetaContent(rawTitle, MAX_TITLE_LENGTH);
    const description = this.sanitizeMetaContent(
      rawDescription,
      MAX_DESCRIPTION_LENGTH,
    );
    // Relative image addresses resolve against the page that was actually
    // served, which differs from the requested URL when a shortener redirected.
    const image = this.sanitizeImageUrl(
      this.getMetaTag($, 'og:image') || '',
      finalUrl,
    );
    const siteName = this.sanitizeMetaContent(
      this.getMetaTag($, 'og:site_name') || new URL(finalUrl).hostname,
      MAX_SITE_NAME_LENGTH,
    );

    if (!title && !description && !image) {
      return null;
    }

    return { url, title, description, image, siteName };
  }

  private classifyFailure(error: unknown): ClassifiedFailure {
    const chain = causeChain(error);

    for (const candidate of chain) {
      if (candidate instanceof UnsafeLinkPreviewUrlError) {
        return {
          outcome: 'blocked',
          message: PREVIEW_UNAVAILABLE_MESSAGE,
          detail: `reason=${candidate.reason}`,
        };
      }
      if (candidate instanceof BlockedAddressError) {
        return {
          outcome: 'blocked',
          message: PREVIEW_UNAVAILABLE_MESSAGE,
          detail: 'reason=blocked_address',
        };
      }
      if (candidate instanceof NotHtmlResponseError) {
        return {
          outcome: 'not_html',
          message: 'URL does not point to an HTML resource',
          detail: 'reason=not_html',
        };
      }
    }

    for (const candidate of chain) {
      if (!isAxiosError(candidate)) {
        continue;
      }
      const code = candidate.code ?? 'unknown';
      if (TIMEOUT_CODES.has(code)) {
        return {
          outcome: 'timeout',
          message: PREVIEW_UNAVAILABLE_MESSAGE,
          detail: `code=${code}`,
        };
      }
      if (candidate.response || UPSTREAM_CODES.has(code)) {
        return {
          outcome: 'upstream_error',
          message: PREVIEW_UNAVAILABLE_MESSAGE,
          detail: `code=${code}; status=${candidate.response?.status ?? 'none'}`,
        };
      }
      return {
        outcome: 'network_error',
        message: PREVIEW_UNAVAILABLE_MESSAGE,
        detail: `code=${code}`,
      };
    }

    const first = chain[0];
    return {
      outcome: 'network_error',
      message: PREVIEW_UNAVAILABLE_MESSAGE,
      detail: `kind=${first instanceof Error ? first.name : 'UnknownError'}`,
    };
  }

  private toException(failure: Failure): Error {
    switch (failure.status) {
      case 'unavailable':
        return new ServiceUnavailableException(failure.message);
      case 'timeout':
        return new GatewayTimeoutException(failure.message);
      default:
        return new BadRequestException(failure.message);
    }
  }

  private async waitAtMost<T>(
    promise: Promise<T>,
    maxWaitMs: number,
  ): Promise<T | typeof WAIT_TIMED_OUT> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<typeof WAIT_TIMED_OUT>((resolve) => {
      timer = setTimeout(() => resolve(WAIT_TIMED_OUT), maxWaitMs);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  private async readCachedPreview(
    url: string,
    descriptor: string,
  ): Promise<LinkPreview | null> {
    try {
      const cached = await this.redis.get(this.cacheKey(url));
      if (!cached) {
        return null;
      }
      const preview = this.parseUntrustedPreview(cached, url);
      if (!preview) {
        this.logger.warn(`Invalid link-preview cache entry (${descriptor})`);
      }
      return preview;
    } catch {
      // A cache outage must not turn a best-effort preview into a chat failure.
      this.logger.warn(`Link-preview cache read unavailable (${descriptor})`);
      return null;
    }
  }

  private async readNegativeEntry(
    url: string,
    descriptor: string,
  ): Promise<NegativeKind | null> {
    try {
      const raw = await this.redis.get(this.negativeCacheKey(url));
      if (!raw) {
        return null;
      }
      const entry: unknown = JSON.parse(raw);
      const kind = isRecord(entry) ? entry['kind'] : undefined;
      return kind === 'empty' || kind === 'error' ? kind : null;
    } catch {
      this.logger.warn(`Link-preview cache read unavailable (${descriptor})`);
      return null;
    }
  }

  private async rememberResolution(
    url: string,
    descriptor: string,
    resolution: Resolution,
  ): Promise<void> {
    let key: string;
    let value: string;
    let ttlSeconds: number;
    if (resolution.preview) {
      key = this.cacheKey(url);
      value = JSON.stringify(resolution.preview);
      ttlSeconds = CACHE_TTL_SECONDS;
    } else {
      const kind: NegativeKind = resolution.failure ? 'error' : 'empty';
      key = this.negativeCacheKey(url);
      value = JSON.stringify({ kind });
      ttlSeconds = NEGATIVE_CACHE_TTL_SECONDS;
    }

    try {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } catch {
      // The result is still valid when Redis is unavailable.
      this.logger.warn(`Link-preview cache write unavailable (${descriptor})`);
    }
  }

  private getMetaTag($: cheerio.CheerioAPI, property: string): string {
    return (
      $(`meta[property="${property}"]`).attr('content') ||
      $(`meta[name="${property}"]`).attr('content') ||
      ''
    ).trim();
  }

  private sanitizeMetaContent(raw: string, maxLength: number): string {
    // A hostile page can serve a megabyte-long attribute. Sanitising only ever
    // shrinks text, so anything far beyond what could survive is dropped first
    // instead of being parsed by the (synchronous) sanitiser.
    const bounded =
      raw.length > maxLength * RAW_TEXT_BOUND_FACTOR
        ? raw.slice(0, maxLength * RAW_TEXT_BOUND_FACTOR)
        : raw;
    const sanitized = this.dompurify.sanitize(bounded, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
    const $inner = cheerio.load(`<div>${sanitized}</div>`);
    return truncate(tidyText($inner('div').text()), maxLength).trimEnd();
  }

  private sanitizeImageUrl(raw: string, pageUrl: string): string {
    if (!raw || raw.length > MAX_LINK_PREVIEW_URL_LENGTH) {
      return '';
    }

    try {
      const parsed = new URL(raw, pageUrl);
      if (parsed.href.length > MAX_LINK_PREVIEW_URL_LENGTH) {
        return '';
      }
      assertPublicHttpUrl(parsed);
      return parsed.href;
    } catch {
      return '';
    }
  }

  private cacheKey(url: string): string {
    return `${CACHE_PREFIX}:${this.digest(url)}`;
  }

  private negativeCacheKey(url: string): string {
    return `${NEGATIVE_CACHE_PREFIX}:${this.digest(url)}`;
  }

  private digest(url: string): string {
    return createHash('sha256').update(url).digest('hex');
  }

  private urlDescriptor(url: URL): string {
    return `${url.hostname}#${this.digest(url.href).slice(0, 12)}`;
  }
}
