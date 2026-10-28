import type { Mock } from 'vitest';

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

const { mockSanitize } = vi.hoisted(() => ({
  mockSanitize: (dirty: string): string =>
    typeof dirty === 'string' ? dirty.replace(/<[^>]*>/g, '') : dirty,
}));

vi.mock('dompurify', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    sanitize: mockSanitize,
    setConfig: vi.fn(),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { LinkPreviewService } from './link-preview.service';
import { MetricsService } from '../metrics/metrics.service';

function errorWithCode(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

describe('LinkPreviewService observability and deadlines', () => {
  let service: LinkPreviewService;
  let httpService: { get: Mock };
  let redis: { get: Mock; set: Mock };
  let metrics: {
    recordLinkPreviewRequest: Mock;
    observeLinkPreviewFetch: Mock;
  };

  beforeEach(async () => {
    httpService = { get: vi.fn() };
    redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };
    metrics = {
      recordLinkPreviewRequest: vi.fn(),
      observeLinkPreviewFetch: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkPreviewService,
        { provide: HttpService, useValue: httpService },
        { provide: 'REDIS_CLIENT', useValue: redis },
        { provide: MetricsService, useValue: metrics },
      ],
    }).compile();

    service = module.get(LinkPreviewService);
  });

  afterEach(() => vi.restoreAllMocks());

  function mockHtmlResponse(html: string, contentType = 'text/html'): void {
    httpService.get.mockReturnValue(
      of({ data: html, headers: { 'content-type': contentType } }),
    );
  }

  describe('scrape deadlines', () => {
    it('combines a per-leg idle timeout with an overall abort signal', async () => {
      mockHtmlResponse('<html><head><title>Bounded</title></head></html>');

      await service.getPreview('https://example.com/');

      const config = httpService.get.mock.calls[0][1] as {
        timeout: number;
        signal: unknown;
      };
      expect(config.timeout).toBe(5_000);
      expect(config.signal).toBeInstanceOf(AbortSignal);
      expect((config.signal as AbortSignal).aborted).toBe(false);
    });

    it('uses a fresh deadline for every scrape', async () => {
      mockHtmlResponse('<html><head><title>Bounded</title></head></html>');

      await service.getPreview('https://example.com/one');
      await service.getPreview('https://example.com/two');

      const first = httpService.get.mock.calls[0][1] as { signal: unknown };
      const second = httpService.get.mock.calls[1][1] as { signal: unknown };
      expect(first.signal).not.toBe(second.signal);
    });

    it('reports a deadline abort as a stable bad request classified as a timeout', async () => {
      httpService.get.mockReturnValue(
        throwError(() => errorWithCode('canceled', 'ERR_CANCELED')),
      );
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(service.getPreview('https://slow.example/')).rejects.toThrow(
        'Unable to fetch preview for this URL',
      );

      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith(
        'failed',
        'timeout',
      );
    });
  });

  describe('guarded DNS lookup', () => {
    type LookupResult = {
      error: NodeJS.ErrnoException | null;
      address: unknown;
    };
    type GuardedLookup = (
      hostname: string,
      options: object,
      callback: (
        error: NodeJS.ErrnoException | null,
        address: unknown,
        family: number,
      ) => void,
    ) => void;

    async function resolveThroughGuard(
      hostname: string,
    ): Promise<LookupResult> {
      mockHtmlResponse('<html><head><title>x</title></head></html>');
      await service.getPreview('https://example.com/');
      const config = httpService.get.mock.calls[0][1] as {
        httpsAgent: { options: { lookup: GuardedLookup } };
      };

      return new Promise((resolve) => {
        config.httpsAgent.options.lookup(hostname, {}, (error, address) =>
          resolve({ error, address }),
        );
      });
    }

    it('rejects a hostname that resolves to a non-public address with a tagged error', async () => {
      const { error } = await resolveThroughGuard('localhost');

      expect(error?.code).toBe('ESSRFBLOCKED');
      expect(error?.message).toContain('SSRF blocked');
    });

    it('lets a public address through unchanged', async () => {
      const { error, address } = await resolveThroughGuard('8.8.8.8');

      expect(error).toBeNull();
      expect(address).toBe('8.8.8.8');
    });
  });

  describe('metrics', () => {
    it('records a fetched outcome and the origin latency for a successful scrape', async () => {
      mockHtmlResponse('<html><head><title>Hello</title></head></html>');

      await service.getPreview('https://example.com/post');

      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledTimes(1);
      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith('fetched');
      expect(metrics.observeLinkPreviewFetch).toHaveBeenCalledWith(
        'fetched',
        expect.any(Number),
      );
      const duration = metrics.observeLinkPreviewFetch.mock.calls[0][1];
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('records an empty outcome when the page exposes no preview metadata', async () => {
      mockHtmlResponse('<html><body>Body only</body></html>');

      await expect(
        service.getPreview('https://example.com/empty'),
      ).resolves.toBeNull();

      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith('empty');
      expect(metrics.observeLinkPreviewFetch).toHaveBeenCalledWith(
        'empty',
        expect.any(Number),
      );
    });

    it('records cache hits without an origin latency sample', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({
          url: 'https://example.com/cached',
          title: 'Cached',
          description: '',
          image: '',
          siteName: 'example.com',
        }),
      );

      await service.getPreview('https://example.com/cached');

      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith(
        'cache_hit',
      );
      expect(metrics.observeLinkPreviewFetch).not.toHaveBeenCalled();
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('does not count an unusable cache entry as a hit', async () => {
      redis.get.mockResolvedValue('not json');
      mockHtmlResponse('<html><head><title>Fresh</title></head></html>');

      await service.getPreview('https://example.com/stale');

      expect(metrics.recordLinkPreviewRequest).not.toHaveBeenCalledWith(
        'cache_hit',
      );
      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith('fetched');
    });

    it.each([
      ['http://localhost/admin', 'private_network'],
      ['http://169.254.169.254/latest/meta-data', 'private_network'],
      ['http://[::ffff:7f00:1]/', 'private_network'],
      ['not a url', 'invalid_url'],
      ['ftp://example.com/file', 'invalid_url'],
      ['https://user:pass@example.com/', 'invalid_url'],
      ['https://example.com:8443/', 'invalid_url'],
    ])('records a rejected outcome for %s as %s', async (url, reason) => {
      await expect(service.getPreview(url)).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith(
        'rejected',
        reason,
      );
      expect(httpService.get).not.toHaveBeenCalled();
      expect(metrics.observeLinkPreviewFetch).not.toHaveBeenCalled();
    });

    it.each<[string, Error, string]>([
      [
        'DNS resolving to a private address',
        errorWithCode(
          'SSRF blocked: resolved address is not publicly routable',
          'ESSRFBLOCKED',
        ),
        'blocked_network',
      ],
      [
        'a redirect to a disallowed target',
        new Error('Redirect rejected', {
          cause: new BadRequestException(
            'Private network URLs are not allowed',
          ),
        }),
        'blocked_network',
      ],
      [
        'the overall deadline aborting the request',
        errorWithCode('canceled', 'ERR_CANCELED'),
        'timeout',
      ],
      [
        'the idle timeout',
        errorWithCode('timeout of 5000ms exceeded', 'ECONNABORTED'),
        'timeout',
      ],
      [
        'a socket timeout',
        errorWithCode('connect ETIMEDOUT', 'ETIMEDOUT'),
        'timeout',
      ],
      [
        'an oversized response',
        errorWithCode(
          'maxContentLength size of 5000000 exceeded',
          'ERR_BAD_RESPONSE',
        ),
        'too_large',
      ],
      [
        'an oversized redirect body',
        errorWithCode(
          'Request body larger than maxBodyLength limit',
          'ERR_FR_MAX_BODY_LENGTH_EXCEEDED',
        ),
        'too_large',
      ],
      [
        'too many redirects',
        errorWithCode(
          'Maximum number of redirects exceeded',
          'ERR_FR_TOO_MANY_REDIRECTS',
        ),
        'redirect',
      ],
      [
        'an upstream 5xx',
        errorWithCode(
          'Request failed with status code 503',
          'ERR_BAD_RESPONSE',
        ),
        'upstream_status',
      ],
      [
        'an upstream 404',
        errorWithCode('Request failed with status code 404', 'ERR_BAD_REQUEST'),
        'upstream_status',
      ],
      [
        'an unresolvable host',
        errorWithCode('getaddrinfo ENOTFOUND missing.example', 'ENOTFOUND'),
        'network',
      ],
      [
        'a refused connection',
        errorWithCode('connect ECONNREFUSED', 'ECONNREFUSED'),
        'network',
      ],
      ['an error without a code', new Error('boom'), 'other'],
    ])('classifies %s as %s', async (_label, error, reason) => {
      httpService.get.mockReturnValue(throwError(() => error));
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(
        service.getPreview('https://example.com/failing'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith(
        'failed',
        reason,
      );
      expect(metrics.observeLinkPreviewFetch).toHaveBeenCalledWith(
        'failed',
        expect.any(Number),
      );
    });

    it('classifies a non-HTML response as non_html', async () => {
      mockHtmlResponse('{}', 'application/json');
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(
        service.getPreview('https://example.com/data.json'),
      ).rejects.toThrow('URL does not point to an HTML resource');

      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledWith(
        'failed',
        'non_html',
      );
    });

    it('counts exactly one outcome per request', async () => {
      httpService.get.mockReturnValue(
        throwError(() => errorWithCode('refused', 'ECONNREFUSED')),
      );
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(
        service.getPreview('https://example.com/once'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(metrics.recordLinkPreviewRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('failure logging', () => {
    it('logs the bounded reason without URLs or provider messages', async () => {
      const errorSpy = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      httpService.get.mockReturnValue(
        throwError(() =>
          errorWithCode(
            'connect ETIMEDOUT secret-host.internal token=provider-secret',
            'ETIMEDOUT',
          ),
        ),
      );

      await expect(
        service.getPreview('https://example.com/private?token=super-secret'),
      ).rejects.toBeInstanceOf(BadRequestException);

      const log = errorSpy.mock.calls
        .map(([message]) => String(message))
        .join('\n');
      expect(log).toContain('reason=timeout');
      expect(log).toContain('example.com#');
      expect(log).not.toContain('super-secret');
      expect(log).not.toContain('/private');
      expect(log).not.toContain('provider-secret');
      expect(log).not.toContain('secret-host.internal');
    });
  });

  describe('with the real metrics registry', () => {
    it('exposes scrape outcomes and latency on the Prometheus endpoint', async () => {
      const registry = new MetricsService();
      const module = await Test.createTestingModule({
        providers: [
          LinkPreviewService,
          { provide: HttpService, useValue: httpService },
          { provide: 'REDIS_CLIENT', useValue: redis },
          { provide: MetricsService, useValue: registry },
        ],
      }).compile();
      const wired = module.get(LinkPreviewService);
      mockHtmlResponse('<html><head><title>Wired</title></head></html>');

      await wired.getPreview('https://example.com/wired');
      await expect(
        wired.getPreview('http://127.0.0.1/'),
      ).rejects.toBeInstanceOf(BadRequestException);

      const output = await registry.getMetrics();
      expect(output).toContain(
        'hellotalk_link_preview_requests_total{outcome="fetched",reason="none"} 1',
      );
      expect(output).toContain(
        'hellotalk_link_preview_requests_total{outcome="rejected",reason="private_network"} 1',
      );
      expect(output).toContain(
        'hellotalk_link_preview_fetch_duration_seconds_count{outcome="fetched"} 1',
      );
    });
  });

  describe('without a metrics provider', () => {
    it('still scrapes and degrades normally', async () => {
      const bare = new LinkPreviewService(
        httpService as unknown as HttpService,
        redis as never,
      );
      mockHtmlResponse('<html><head><title>No metrics</title></head></html>');

      await expect(
        bare.getPreview('https://example.com/bare'),
      ).resolves.toMatchObject({ title: 'No metrics' });

      await expect(bare.getPreview('http://localhost')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
