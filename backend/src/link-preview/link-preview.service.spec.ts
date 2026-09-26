import type { Mock } from 'vitest';
import { createHash } from 'crypto';
// Mock jsdom and dompurify at module level to avoid parsing ESM dependencies
vi.mock('jsdom', () => ({
  JSDOM: vi.fn().mockImplementation(function () {
    return {
      window: {
        document: {
          createElement: vi.fn(),
          createDocumentFragment: vi.fn(),
        },
        Node: {
          ELEMENT_NODE: 1,
          TEXT_NODE: 3,
          DOCUMENT_FRAGMENT_NODE: 11,
        },
        NodeFilter: {
          SHOW_ELEMENT: 1,
          SHOW_TEXT: 4,
        },
      },
    };
  }),
}));

// Strict DOMPurify mock that strips ALL HTML tags (matching strict config)
const { mockSanitize } = vi.hoisted(() => {
  const sanitize = (dirty: string): string => {
    if (typeof dirty !== 'string') return dirty;
    // Remove script/style elements and their content entirely
    let result = dirty
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
    // Strip all remaining HTML tags
    result = result.replace(/<[^>]*>/g, '');
    // Decode common HTML entities
    result = result
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'");
    return result;
  };
  return { mockSanitize: vi.fn(sanitize) };
});

vi.mock('dompurify', () => {
  return {
    __esModule: true,
    default: vi.fn(() => ({
      sanitize: mockSanitize,
      setConfig: vi.fn(),
    })),
  };
});

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  GatewayTimeoutException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError, CanceledError } from 'axios';
import { from, of, throwError } from 'rxjs';
import { Readable } from 'stream';
import { LinkPreviewService } from './link-preview.service';
import { UnsafeLinkPreviewUrlError } from './link-preview-url';
import { BlockedAddressError } from './safe-html-fetch';
import { MetricsService } from '../metrics/metrics.service';

type HttpResponse = {
  data: unknown;
  headers: Record<string, string>;
  request?: unknown;
};

describe('LinkPreviewService', () => {
  let service: LinkPreviewService;
  let httpService: { get: Mock };
  let redis: { get: Mock; set: Mock };
  let metrics: {
    recordLinkPreviewRequest: Mock;
    observeLinkPreviewFetch: Mock;
    setLinkPreviewInflightFetches: Mock;
  };

  beforeEach(async () => {
    redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };

    httpService = {
      get: vi.fn(),
    };

    metrics = {
      recordLinkPreviewRequest: vi.fn(),
      observeLinkPreviewFetch: vi.fn(),
      setLinkPreviewInflightFetches: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkPreviewService,
        { provide: HttpService, useValue: httpService },
        { provide: MetricsService, useValue: metrics },
        { provide: 'REDIS_CLIENT', useValue: redis },
      ],
    }).compile();

    service = module.get(LinkPreviewService);
  });

  afterEach(() => vi.clearAllMocks());

  function mockHtmlResponse(html: string, contentType = 'text/html') {
    httpService.get.mockReturnValue(
      of({ data: html, headers: { 'content-type': contentType } }),
    );
  }

  function mockStreamedResponse(
    bytes: Buffer,
    contentType: string,
    extra: Partial<HttpResponse> = {},
  ) {
    httpService.get.mockReturnValue(
      of({
        data: Readable.from([bytes]),
        headers: { 'content-type': contentType },
        ...extra,
      }),
    );
  }

  /** An origin response the test releases by hand, to hold a scrape in flight. */
  function deferredResponse(): {
    release: (response: HttpResponse) => void;
    observable: ReturnType<typeof from>;
  } {
    let release: (response: HttpResponse) => void = () => undefined;
    const promise = new Promise<HttpResponse>((resolve) => {
      release = resolve;
    });
    return { release, observable: from(promise) };
  }

  const htmlResponse = (html: string): HttpResponse => ({
    data: html,
    headers: { 'content-type': 'text/html' },
  });

  async function flushAsyncWork(): Promise<void> {
    await new Promise((resolve) => setImmediate(resolve));
  }

  function loggedWarnings(spy: ReturnType<typeof vi.spyOn>): string {
    return spy.mock.calls.map(([message]) => String(message)).join('\n');
  }

  describe('input validation', () => {
    it('rejects a malformed URL', async () => {
      await expect(service.getPreview('not a url')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('rejects URLs longer than the accepted input bound', async () => {
      const url = `https://example.com/${'a'.repeat(2_100)}`;

      await expect(service.getPreview(url)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('rejects SSRF attempts via local IPs (localhost)', async () => {
      await expect(
        service.getPreview('http://localhost'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('rejects canonical IPv4-mapped IPv6 loopback URLs', async () => {
      await expect(
        service.getPreview('http://[::ffff:7f00:1]/'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('rejects SSRF attempts via cloud metadata IPs', async () => {
      await expect(
        service.getPreview('http://169.254.169.254/latest/meta-data/'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('rejects SSRF attempts via private network IPs', async () => {
      await expect(
        service.getPreview('http://192.168.1.1/admin'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('rejects internal service aliases without touching the network', async () => {
      await expect(
        service.getPreview('http://backend/'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('rejects non-http(s) protocols', async () => {
      await expect(
        service.getPreview('file:///etc/passwd'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects URLs with embedded credentials', async () => {
      await expect(
        service.getPreview('https://user:pass@example.com'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects non-default ports', async () => {
      await expect(
        service.getPreview('https://example.com:8080'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('explains why a URL was refused and counts it as invalid input', async () => {
      await expect(
        service.getPreview('https://example.com:8080'),
      ).rejects.toThrow('Custom ports are not allowed');

      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith(
        'invalid_url',
      );
      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('caching', () => {
    it('uses a hashed cache key instead of persisting the raw URL', async () => {
      const rawUrl = 'https://example.com/post?token=super-secret';
      mockHtmlResponse('<html><head><title>Hello</title></head></html>');

      await service.getPreview(rawUrl);

      const normalizedUrl = new URL(rawUrl).href;
      const digest = createHash('sha256').update(normalizedUrl).digest('hex');
      const expectedKey = `link_preview:v2:${digest}`;
      expect(redis.get).toHaveBeenCalledWith(expectedKey);
      expect(redis.set).toHaveBeenCalledWith(
        expectedKey,
        expect.any(String),
        'EX',
        3_600,
      );
      expect(expectedKey).not.toContain('super-secret');
    });

    it('returns a validated cached preview without hitting the network', async () => {
      const cached = {
        url: 'https://example.com/',
        title: 'Cached title',
        description: '',
        image: '',
        siteName: 'example.com',
      };
      redis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getPreview('https://example.com');

      expect(result).toEqual(cached);
      expect(httpService.get).not.toHaveBeenCalled();
      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith(
        'cache_hit',
      );
    });

    it('sanitizes and bounds cached metadata before returning it', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({
          url: 'https://example.com/',
          title: `<b>${'t'.repeat(400)}</b>`,
          description: 'd'.repeat(1_200),
          image: 'javascript:alert(1)',
          siteName: 's'.repeat(250),
        }),
      );

      const result = await service.getPreview('https://example.com');

      expect(result?.title).toBe('t'.repeat(300));
      expect(result?.description).toBe('d'.repeat(1_000));
      expect(result?.image).toBe('');
      expect(result?.siteName).toBe('s'.repeat(200));
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('ignores a cache entry bound to a different URL and fetches fresh metadata', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({
          url: 'https://other.example/',
          title: 'Wrong page',
          description: '',
          image: '',
          siteName: 'other.example',
        }),
      );
      mockHtmlResponse('<html><head><title>Fresh page</title></head></html>');

      const result = await service.getPreview('https://example.com/');

      expect(result?.title).toBe('Fresh page');
      expect(httpService.get).toHaveBeenCalledTimes(1);
    });

    it('ignores oversized cache entries before parsing and fetches fresh metadata', async () => {
      redis.get.mockResolvedValue('x'.repeat(16_385));
      mockHtmlResponse('<html><head><title>Fresh page</title></head></html>');

      const result = await service.getPreview('https://example.com/');

      expect(result?.title).toBe('Fresh page');
      expect(httpService.get).toHaveBeenCalledTimes(1);
    });

    it('continues when the cache read is unavailable', async () => {
      redis.get.mockRejectedValue(new Error('redis unavailable'));
      mockHtmlResponse('<html><head><title>Fresh</title></head></html>');

      const result = await service.getPreview('https://example.com');

      expect(result?.title).toBe('Fresh');
      expect(httpService.get).toHaveBeenCalledTimes(1);
    });

    it('returns a fresh preview when the cache write is unavailable', async () => {
      redis.set.mockRejectedValueOnce(new Error('redis unavailable'));
      mockHtmlResponse('<html><head><title>Fresh</title></head></html>');

      const result = await service.getPreview('https://example.com');

      expect(result?.title).toBe('Fresh');
    });

    it('does not fall over when the cache entry is not valid JSON', async () => {
      redis.get.mockResolvedValue('{not json');
      mockHtmlResponse('<html><head><title>Recovered</title></head></html>');

      const result = await service.getPreview('https://example.com/');

      expect(result?.title).toBe('Recovered');
    });
  });

  describe('metadata extraction', () => {
    it('extracts OpenGraph tags and caches the result', async () => {
      mockHtmlResponse(`
        <html><head>
          <meta property="og:title" content="Great Article" />
          <meta property="og:description" content="A description" />
          <meta property="og:image" content="/img/cover.png" />
          <meta property="og:site_name" content="Example" />
        </head><body></body></html>
      `);

      const result = await service.getPreview('https://example.com/post');

      expect(result).toEqual({
        url: 'https://example.com/post',
        title: 'Great Article',
        description: 'A description',
        image: 'https://example.com/img/cover.png',
        siteName: 'Example',
      });
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^link_preview:v2:[a-f0-9]{64}$/),
        JSON.stringify(result),
        'EX',
        3_600,
      );
      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith('fetched');
    });

    it('bounds scraped metadata before caching or returning it', async () => {
      mockHtmlResponse(`
        <html><head>
          <meta property="og:title" content="${'t'.repeat(400)}" />
          <meta property="og:description" content="${'d'.repeat(1_200)}" />
          <meta property="og:site_name" content="${'s'.repeat(250)}" />
        </head></html>
      `);

      const result = await service.getPreview('https://example.com/');

      expect(result?.title).toBe('t'.repeat(300));
      expect(result?.description).toBe('d'.repeat(1_000));
      expect(result?.siteName).toBe('s'.repeat(200));
      expect(redis.set).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify(result),
        'EX',
        3_600,
      );
    });

    it('falls back to <title> and meta description when OG tags are absent', async () => {
      mockHtmlResponse(`
        <html><head>
          <title>Fallback Title</title>
          <meta name="description" content="Fallback description" />
        </head></html>
      `);

      const result = await service.getPreview('https://example.com/');

      expect(result?.title).toBe('Fallback Title');
      expect(result?.description).toBe('Fallback description');
      expect(result?.siteName).toBe('example.com');
    });

    it('prefers the document title over titles of inline SVG graphics', async () => {
      mockHtmlResponse(`
        <html><head><title>Real page title</title></head>
        <body><svg><title>Icon caption</title></svg></body></html>
      `);

      const result = await service.getPreview('https://example.com/');

      expect(result?.title).toBe('Real page title');
    });

    it('strips markup from scraped fields including the site name', async () => {
      mockHtmlResponse(`
        <html><head>
          <meta property="og:title" content="&lt;script&gt;alert(1)&lt;/script&gt;Title" />
          <meta property="og:site_name" content="&lt;b&gt;Example&lt;/b&gt;" />
        </head></html>
      `);

      const result = await service.getPreview('https://example.com/');

      expect(result?.title).toBe('Title');
      expect(result?.siteName).toBe('Example');
    });

    it('sanitizes malicious HTML inputs safely', async () => {
      mockHtmlResponse(`
        <html><head>
          <meta property="og:title" content="Hello &lt;b onmouseover=&quot;alert()&quot;&gt;World&lt;/b&gt;" />
        </head></html>
      `);

      const result = await service.getPreview('https://example.com/');

      expect(result?.title).toBe('Hello World');
    });

    it('collapses whitespace and removes invisible bidi controls from text fields', async () => {
      mockHtmlResponse(
        `<html><head><title>\n   Spaced \t out\n\ttitle  \u{202e}gpj.exe\u{200b}\u{2066}!</title></head></html>`,
      );

      const result = await service.getPreview('https://example.com/');

      expect(result?.title).toBe('Spaced out title gpj.exe!');
    });

    it('keeps zero-width joiners that some scripts and emoji sequences need', async () => {
      mockHtmlResponse(
        '<html><head><title>می\u{200c}خواهم 👨\u{200d}👩\u{200d}👧</title></head></html>',
      );

      const result = await service.getPreview('https://example.com/');

      expect(result?.title).toBe('می\u{200c}خواهم 👨\u{200d}👩\u{200d}👧');
    });

    it('does not leave trailing whitespace where a long title was cut', async () => {
      mockHtmlResponse(
        `<html><head><title>${'word '.repeat(80)}</title></head></html>`,
      );

      const result = await service.getPreview('https://example.com/');

      expect(result?.title.length).toBeLessThanOrEqual(300);
      expect(result?.title.endsWith(' ')).toBe(false);
      expect(result?.title.startsWith('word word')).toBe(true);
    });

    it('never cuts a surrogate pair in half when truncating', async () => {
      mockHtmlResponse(
        `<html><head><title>${'a'.repeat(299)}😀 tail</title></head></html>`,
      );

      const result = await service.getPreview('https://example.com/');

      expect(result?.title).toBe('a'.repeat(299));
      expect(result?.title.charCodeAt(result.title.length - 1)).not.toBe(
        0xd83d,
      );
    });

    it('cuts hostile metadata that is hundreds of kilobytes long before it reaches the sanitiser', async () => {
      mockSanitize.mockClear();
      mockHtmlResponse(`
        <html><head>
          <meta property="og:title" content="${'A'.repeat(400_000)}" />
          <meta property="og:description" content="${'B'.repeat(400_000)}" />
        </head></html>
      `);

      const result = await service.getPreview('https://example.com/');

      expect(result?.title).toBe('A'.repeat(300));
      expect(result?.description).toBe('B'.repeat(1_000));
      const largestInput = Math.max(
        ...mockSanitize.mock.calls.map(([input]) => String(input).length),
      );
      expect(largestInput).toBeLessThanOrEqual(4_000);
    });

    it('drops image URLs that are longer than any address the scraper accepts', async () => {
      mockHtmlResponse(`
        <html><head>
          <meta property="og:title" content="Safe title" />
          <meta property="og:image" content="https://example.com/${'a'.repeat(5_000)}.png" />
        </head></html>
      `);

      const result = await service.getPreview('https://example.com/');

      expect(result?.title).toBe('Safe title');
      expect(result?.image).toBe('');
    });

    it('drops unsafe image protocols instead of exposing them to the client', async () => {
      mockHtmlResponse(`
        <html><head>
          <meta property="og:title" content="Safe title" />
          <meta property="og:image" content="javascript:alert(1)" />
        </head></html>
      `);

      const result = await service.getPreview('https://example.com/');

      expect(result?.image).toBe('');
    });

    it('drops private-network image URLs from the returned preview', async () => {
      mockHtmlResponse(`
        <html><head>
          <meta property="og:title" content="Safe title" />
          <meta property="og:image" content="http://127.0.0.1/private.png" />
        </head></html>
      `);

      const result = await service.getPreview('https://example.com/');

      expect(result?.image).toBe('');
    });

    it('resolves relative image URLs against the page that was actually served', async () => {
      httpService.get.mockReturnValue(
        of({
          ...htmlResponse(`
            <html><head>
              <meta property="og:title" content="Landing" />
              <meta property="og:image" content="/img/cover.png" />
            </head></html>
          `),
          request: {
            res: { responseUrl: 'https://www.target.example/landing' },
          },
        }),
      );

      const result = await service.getPreview('https://short.example/abc');

      expect(result).toMatchObject({
        url: 'https://short.example/abc',
        image: 'https://www.target.example/img/cover.png',
        siteName: 'www.target.example',
      });
    });

    it('decodes pages that declare a legacy charset in the response header', async () => {
      // "日本語" encoded as Shift_JIS.
      const title = Buffer.from([0x93, 0xfa, 0x96, 0x7b, 0x8c, 0xea]);
      mockStreamedResponse(
        Buffer.concat([
          Buffer.from('<html><head><title>'),
          title,
          Buffer.from('</title></head></html>'),
        ]),
        'text/html; charset=Shift_JIS',
      );

      const result = await service.getPreview('https://example.jp/');

      expect(result?.title).toBe('日本語');
    });

    it('decodes pages that declare their charset in a meta tag', async () => {
      // "café" encoded as ISO-8859-1.
      mockStreamedResponse(
        Buffer.concat([
          Buffer.from(
            '<html><head><meta charset="iso-8859-1"><title>caf',
            'latin1',
          ),
          Buffer.from([0xe9]),
          Buffer.from('</title></head></html>'),
        ]),
        'text/html',
      );

      const result = await service.getPreview('https://example.fr/');

      expect(result?.title).toBe('café');
    });

    it('treats undeclared charsets as UTF-8', async () => {
      mockStreamedResponse(
        Buffer.from('<html><head><title>Ünïcode ✓ مرحبا</title></head></html>'),
        'text/html',
      );

      const result = await service.getPreview('https://example.com/');

      expect(result?.title).toBe('Ünïcode ✓ مرحبا');
    });

    it('falls back to UTF-8 when the declared charset is not recognised', async () => {
      mockStreamedResponse(
        Buffer.from('<html><head><title>Plain title</title></head></html>'),
        'text/html; charset=not-a-charset',
      );

      const result = await service.getPreview('https://example.com/');

      expect(result?.title).toBe('Plain title');
    });

    it('returns null and remembers the emptiness when a page exposes no metadata', async () => {
      mockHtmlResponse('<html><head></head><body>Body only</body></html>');

      await expect(
        service.getPreview('https://example.com/empty'),
      ).resolves.toBeNull();

      const negativeKey = `link_preview:v2:negative:${createHash('sha256')
        .update('https://example.com/empty')
        .digest('hex')}`;
      expect(redis.set).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledWith(
        negativeKey,
        JSON.stringify({ kind: 'empty' }),
        'EX',
        300,
      );
      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith('empty');
    });
  });

  describe('failure handling', () => {
    it('rejects non-HTML responses with a specific message', async () => {
      mockHtmlResponse('{}', 'application/json');

      await expect(
        service.getPreview('https://example.com/data.json'),
      ).rejects.toThrow('URL does not point to an HTML resource');
      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith('not_html');
    });

    it('does not log raw URLs or provider messages when a fetch fails', async () => {
      const warnSpy = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const rawUrl = 'https://example.com/private?token=super-secret';
      httpService.get.mockReturnValue(
        throwError(() => new Error('provider leaked token=provider-secret')),
      );

      await expect(service.getPreview(rawUrl)).rejects.toBeInstanceOf(
        BadRequestException,
      );

      const log = loggedWarnings(warnSpy);
      expect(log).not.toContain('super-secret');
      expect(log).not.toContain('/private');
      expect(log).not.toContain('provider-secret');
      expect(log).toContain('example.com#');
      expect(log).toContain('outcome=network_error');
    });

    it('wraps network failures in a BadRequestException', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('timeout')));

      await expect(
        service.getPreview('https://unreachable.example.com'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith(
        'network_error',
      );
    });

    it('classifies a redirect that the URL policy aborted as blocked', async () => {
      const warnSpy = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const policyError = new UnsafeLinkPreviewUrlError(
        'private_host',
        'Private network URLs are not allowed',
      );
      const wrapped = new AxiosError('Redirected request failed');
      wrapped.cause = new Error('redirect aborted', { cause: policyError });
      httpService.get.mockReturnValue(throwError(() => wrapped));

      await expect(
        service.getPreview('https://evil.example/bounce'),
      ).rejects.toThrow('Unable to fetch preview for this URL');

      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith('blocked');
      expect(metrics.observeLinkPreviewFetch).toHaveBeenCalledWith(
        'blocked',
        expect.any(Number),
      );
      const log = loggedWarnings(warnSpy);
      expect(log).toContain('outcome=blocked');
      expect(log).toContain('reason=private_host');
    });

    it('classifies a hostname that resolves to a private address as blocked', async () => {
      const wrapped = new AxiosError('connect failed');
      wrapped.cause = new BlockedAddressError();
      httpService.get.mockReturnValue(throwError(() => wrapped));

      await expect(
        service.getPreview('https://rebinding.example/'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith('blocked');
    });

    it.each([
      ['a socket timeout', new AxiosError('timeout', 'ECONNABORTED')],
      ['the total deadline aborting the request', new CanceledError()],
    ])('classifies %s as a timeout', async (_label, error) => {
      httpService.get.mockReturnValue(throwError(() => error));

      await expect(
        service.getPreview('https://slow.example/'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith('timeout');
    });

    it('classifies HTTP error statuses as upstream failures without logging provider text', async () => {
      const warnSpy = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      httpService.get.mockReturnValue(
        throwError(
          () =>
            new AxiosError(
              'Request failed with status code 503 https://origin.example/secret',
              'ERR_BAD_RESPONSE',
              undefined,
              undefined,
              { status: 503 } as never,
            ),
        ),
      );

      await expect(
        service.getPreview('https://origin.example/page'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith(
        'upstream_error',
      );
      const log = loggedWarnings(warnSpy);
      expect(log).toContain('status=503');
      expect(log).not.toContain('/secret');
    });

    it('classifies too many redirects as an upstream failure', async () => {
      httpService.get.mockReturnValue(
        throwError(
          () =>
            new AxiosError(
              'Maximum redirects exceeded',
              'ERR_FR_TOO_MANY_REDIRECTS',
            ),
        ),
      );

      await expect(
        service.getPreview('https://loop.example/'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith(
        'upstream_error',
      );
    });

    it('measures how long each origin scrape took', async () => {
      mockHtmlResponse('<html><head><title>Timed</title></head></html>');

      await service.getPreview('https://example.com/');

      expect(metrics.observeLinkPreviewFetch).toHaveBeenCalledWith(
        'fetched',
        expect.any(Number),
      );
    });
  });

  describe('negative caching', () => {
    const negativeKeyFor = (url: string): string =>
      `link_preview:v2:negative:${createHash('sha256').update(url).digest('hex')}`;

    it('remembers a failed scrape briefly so a broken link is not re-fetched', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('boom')));

      await expect(
        service.getPreview('https://down.example/'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(redis.set).toHaveBeenCalledWith(
        negativeKeyFor('https://down.example/'),
        JSON.stringify({ kind: 'error' }),
        'EX',
        300,
      );
    });

    it('answers from a remembered failure without touching the origin', async () => {
      redis.get.mockImplementation((key: string) =>
        Promise.resolve(
          key === negativeKeyFor('https://down.example/')
            ? JSON.stringify({ kind: 'error' })
            : null,
        ),
      );

      await expect(
        service.getPreview('https://down.example/'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(httpService.get).not.toHaveBeenCalled();
      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith(
        'negative_hit',
      );
    });

    it('answers null from a remembered empty page without touching the origin', async () => {
      redis.get.mockImplementation((key: string) =>
        Promise.resolve(
          key === negativeKeyFor('https://empty.example/')
            ? JSON.stringify({ kind: 'empty' })
            : null,
        ),
      );

      await expect(
        service.getPreview('https://empty.example/'),
      ).resolves.toBeNull();

      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('ignores a negative entry it cannot understand and scrapes again', async () => {
      redis.get.mockImplementation((key: string) =>
        Promise.resolve(
          key === negativeKeyFor('https://example.com/')
            ? JSON.stringify({ kind: 'surprise' })
            : null,
        ),
      );
      mockHtmlResponse('<html><head><title>Fresh</title></head></html>');

      const result = await service.getPreview('https://example.com/');

      expect(result?.title).toBe('Fresh');
    });

    it('does not remember its own capacity limit as if the page had failed', async () => {
      const held = Array.from({ length: 20 }, () => deferredResponse());
      held.forEach(({ observable }) =>
        httpService.get.mockReturnValueOnce(observable),
      );
      const running = held.map((_, index) =>
        service.getPreview(`https://busy${index}.example/`),
      );
      await vi.waitFor(() => expect(httpService.get).toHaveBeenCalledTimes(20));

      await expect(
        service.getPreview('https://one-too-many.example/'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(redis.set).not.toHaveBeenCalledWith(
        negativeKeyFor('https://one-too-many.example/'),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );

      held.forEach(({ release }) =>
        release(htmlResponse('<html><head><title>x</title></head></html>')),
      );
      await Promise.all(running);
    });
  });

  describe('concurrency', () => {
    it('shares one origin scrape between concurrent requests for the same URL', async () => {
      const held = deferredResponse();
      httpService.get.mockReturnValue(held.observable);

      const first = service.getPreview('https://example.com/shared');
      await vi.waitFor(() => expect(httpService.get).toHaveBeenCalledTimes(1));
      const second = service.getPreview('https://example.com/shared');
      await flushAsyncWork();
      held.release(
        htmlResponse('<html><head><title>Shared</title></head></html>'),
      );

      const [a, b] = await Promise.all([first, second]);

      expect(httpService.get).toHaveBeenCalledTimes(1);
      expect(a?.title).toBe('Shared');
      expect(b).toEqual(a);
      expect(redis.set).toHaveBeenCalledTimes(1);
    });

    it('scrapes distinct URLs independently', async () => {
      mockHtmlResponse('<html><head><title>One</title></head></html>');

      await Promise.all([
        service.getPreview('https://example.com/a'),
        service.getPreview('https://example.com/b'),
      ]);

      expect(httpService.get).toHaveBeenCalledTimes(2);
    });

    it('reports the number of scrapes in flight and returns to zero', async () => {
      const held = deferredResponse();
      httpService.get.mockReturnValue(held.observable);

      const pending = service.getPreview('https://example.com/gauge');
      await vi.waitFor(() =>
        expect(metrics.setLinkPreviewInflightFetches).toHaveBeenCalledWith(1),
      );
      held.release(htmlResponse('<html><head><title>x</title></head></html>'));
      await pending;

      expect(metrics.setLinkPreviewInflightFetches).toHaveBeenLastCalledWith(0);
    });

    it('lets the same URL be scraped again once the first scrape has finished', async () => {
      mockHtmlResponse('<html><head><title>Again</title></head></html>');
      redis.get.mockResolvedValue(null);

      await service.getPreview('https://example.com/repeat');
      await service.getPreview('https://example.com/repeat');

      expect(httpService.get).toHaveBeenCalledTimes(2);
    });

    it('refuses new scrapes beyond the concurrency cap and reports it as unavailable', async () => {
      const held = Array.from({ length: 20 }, () => deferredResponse());
      held.forEach(({ observable }) =>
        httpService.get.mockReturnValueOnce(observable),
      );
      const running = held.map((_, index) =>
        service.getPreview(`https://cap${index}.example/`),
      );
      await vi.waitFor(() => expect(httpService.get).toHaveBeenCalledTimes(20));

      await expect(
        service.getPreview('https://cap-overflow.example/'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(httpService.get).toHaveBeenCalledTimes(20);
      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith('busy');

      // A request for a URL that is already being scraped still joins it.
      const joiner = service.getPreview('https://cap0.example/');
      await flushAsyncWork();

      held.forEach(({ release }) =>
        release(htmlResponse('<html><head><title>done</title></head></html>')),
      );
      await Promise.all([...running, joiner]);
    });
  });

  describe('caller wait budget', () => {
    it('gives up on a slow origin without cancelling the scrape', async () => {
      const held = deferredResponse();
      httpService.get.mockReturnValue(held.observable);

      await expect(
        service.getPreview('https://slow.example/', { maxWaitMs: 20 }),
      ).rejects.toBeInstanceOf(GatewayTimeoutException);
      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith(
        'wait_timeout',
      );
      expect(redis.set).not.toHaveBeenCalled();

      // The scrape finishes later and warms the cache for the next request.
      held.release(
        htmlResponse('<html><head><title>Slow but fine</title></head></html>'),
      );
      await vi.waitFor(() => expect(redis.set).toHaveBeenCalledTimes(1));
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^link_preview:v2:[a-f0-9]{64}$/),
        expect.stringContaining('Slow but fine'),
        'EX',
        3_600,
      );
    });

    it('does not wait for the budget when the origin answers first', async () => {
      mockHtmlResponse('<html><head><title>Quick</title></head></html>');

      const result = await service.getPreview('https://quick.example/', {
        maxWaitMs: 5_000,
      });

      expect(result?.title).toBe('Quick');
    });

    it('does not leave a timer behind after the origin answers', async () => {
      const clearSpy = vi.spyOn(global, 'clearTimeout');
      mockHtmlResponse('<html><head><title>Quick</title></head></html>');

      await service.getPreview('https://quick.example/', { maxWaitMs: 5_000 });

      expect(clearSpy).toHaveBeenCalled();
      clearSpy.mockRestore();
    });

    it('applies the budget to joiners of a running scrape as well', async () => {
      const held = deferredResponse();
      httpService.get.mockReturnValue(held.observable);
      const leader = service.getPreview('https://slow.example/shared');
      await vi.waitFor(() => expect(httpService.get).toHaveBeenCalledTimes(1));

      await expect(
        service.getPreview('https://slow.example/shared', { maxWaitMs: 20 }),
      ).rejects.toBeInstanceOf(GatewayTimeoutException);

      held.release(
        htmlResponse('<html><head><title>Late</title></head></html>'),
      );
      await expect(leader).resolves.toMatchObject({ title: 'Late' });
    });
  });

  describe('parseUntrustedPreview', () => {
    const expectedUrl = 'https://example.com/post';

    it('accepts a well-formed preview bound to the expected URL', () => {
      const raw = JSON.stringify({
        url: expectedUrl,
        title: 'Title',
        description: 'Description',
        image: 'https://example.com/a.png',
        siteName: 'Example',
      });

      expect(service.parseUntrustedPreview(raw, expectedUrl)).toEqual({
        url: expectedUrl,
        title: 'Title',
        description: 'Description',
        image: 'https://example.com/a.png',
        siteName: 'Example',
      });
    });

    it.each([
      ['malformed JSON', '{oops'],
      ['a JSON array', '[]'],
      ['a JSON string', '"text"'],
      ['null', 'null'],
      [
        'a different page',
        JSON.stringify({ url: 'https://other.example/', title: 'x' }),
      ],
      [
        'an oversized entry',
        JSON.stringify({ url: expectedUrl, title: 'x'.repeat(20_000) }),
      ],
      ['an entry without content', JSON.stringify({ url: expectedUrl })],
    ])('rejects %s', (_label, raw) => {
      expect(service.parseUntrustedPreview(raw, expectedUrl)).toBeNull();
    });

    it('rejects an expected URL that cannot be parsed', () => {
      expect(
        service.parseUntrustedPreview(
          JSON.stringify({ url: 'not a url', title: 'x' }),
          'not a url',
        ),
      ).toBeNull();
    });

    it('re-sanitises every field and falls back to the host for the site name', () => {
      const result = service.parseUntrustedPreview(
        JSON.stringify({
          url: expectedUrl,
          title: '<b>Bold</b>',
          description: 7,
          image: 'http://10.0.0.1/pixel.png',
        }),
        expectedUrl,
      );

      expect(result).toEqual({
        url: expectedUrl,
        title: 'Bold',
        description: '',
        image: '',
        siteName: 'example.com',
      });
    });
  });
});
