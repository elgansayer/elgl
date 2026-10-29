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
import { AxiosError } from 'axios';
import { of, throwError, TimeoutError } from 'rxjs';
import { LinkPreviewService } from './link-preview.service';
import { LinkPreviewFailure } from './link-preview-diagnostics';
import { MetricsService } from '../metrics/metrics.service';

function axiosError(
  message: string,
  code: string,
  status?: number,
): AxiosError {
  const error = new AxiosError(message, code);
  return status === undefined
    ? error
    : Object.assign(error, { response: { status } });
}

describe('LinkPreviewService observability and deadlines', () => {
  let service: LinkPreviewService;
  let httpService: { get: Mock };
  let redis: { get: Mock; set: Mock };
  let metrics: { recordLinkPreview: Mock };

  beforeEach(async () => {
    httpService = { get: vi.fn() };
    redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };
    metrics = { recordLinkPreview: vi.fn() };

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
    it('bounds each origin request with a socket timeout and a body size limit', async () => {
      mockHtmlResponse('<html><head><title>Bounded</title></head></html>');

      await service.getPreview('https://example.com/');

      const config = httpService.get.mock.calls[0][1] as {
        timeout: number;
        maxContentLength: number;
        proxy: boolean;
      };
      expect(config.timeout).toBe(5_000);
      expect(config.maxContentLength).toBe(5_000_000);
      expect(config.proxy).toBe(false);
    });

    it('reports the overall deadline as a bad request classified as a timeout', async () => {
      httpService.get.mockReturnValue(throwError(() => new TimeoutError()));
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      await expect(service.getPreview('https://slow.example/')).rejects.toThrow(
        'Unable to fetch preview for this URL',
      );

      expect(metrics.recordLinkPreview).toHaveBeenCalledWith('failed', {
        reason: 'timeout',
        durationSeconds: expect.any(Number),
      });
    });
  });

  describe('guarded DNS lookup', () => {
    type LookupResult = {
      error: Error | null;
      address: unknown;
    };
    type GuardedLookup = (
      hostname: string,
      options: object,
      callback: (error: Error | null, address: unknown, family: number) => void,
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

    it('rejects a hostname that resolves to a non-public address with a policy failure', async () => {
      const { error } = await resolveThroughGuard('localhost');

      expect(error).toBeInstanceOf(LinkPreviewFailure);
      expect(error?.message).toContain('not publicly routable');
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

      expect(metrics.recordLinkPreview).toHaveBeenCalledTimes(1);
      expect(metrics.recordLinkPreview).toHaveBeenCalledWith('fetched', {
        durationSeconds: expect.any(Number),
      });
      const details = metrics.recordLinkPreview.mock.calls[0][1] as {
        durationSeconds: number;
      };
      expect(details.durationSeconds).toBeGreaterThanOrEqual(0);
    });

    it('records an empty outcome when the page exposes no preview metadata', async () => {
      mockHtmlResponse('<html><body>Body only</body></html>');

      await expect(
        service.getPreview('https://example.com/empty'),
      ).resolves.toBeNull();

      expect(metrics.recordLinkPreview).toHaveBeenCalledWith('empty', {
        durationSeconds: expect.any(Number),
      });
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

      expect(metrics.recordLinkPreview).toHaveBeenCalledTimes(1);
      expect(metrics.recordLinkPreview).toHaveBeenCalledWith('cache_hit');
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('does not count an unusable cache entry as a hit', async () => {
      redis.get.mockResolvedValue('not json');
      mockHtmlResponse('<html><head><title>Fresh</title></head></html>');

      await service.getPreview('https://example.com/stale');

      expect(metrics.recordLinkPreview).not.toHaveBeenCalledWith('cache_hit');
      expect(metrics.recordLinkPreview).toHaveBeenCalledWith('fetched', {
        durationSeconds: expect.any(Number),
      });
    });

    it.each([
      ['http://localhost/admin', 'blocked_target'],
      ['http://169.254.169.254/latest/meta-data', 'blocked_target'],
      ['http://[::ffff:7f00:1]/', 'blocked_target'],
      ['not a url', 'invalid_url'],
      ['ftp://example.com/file', 'invalid_url'],
      ['https://user:pass@example.com/', 'invalid_url'],
      ['https://example.com:8443/', 'blocked_target'],
    ])('records a rejected outcome for %s as %s', async (url, reason) => {
      await expect(service.getPreview(url)).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(metrics.recordLinkPreview).toHaveBeenCalledWith('rejected', {
        reason,
      });
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it.each<[string, Error, string]>([
      [
        'DNS resolving to a private address',
        new LinkPreviewFailure(
          'SSRF blocked: resolved address is not publicly routable',
          'blocked_target',
        ),
        'blocked_target',
      ],
      [
        'a redirect to a disallowed target',
        new Error('Redirect rejected', {
          cause: new LinkPreviewFailure(
            'Private network URLs are not allowed',
            'blocked_target',
          ),
        }),
        'blocked_target',
      ],
      [
        'the overall deadline aborting the request',
        new TimeoutError(),
        'timeout',
      ],
      [
        'the idle timeout',
        axiosError('timeout of 5000ms exceeded', 'ECONNABORTED'),
        'timeout',
      ],
      [
        'a socket timeout',
        axiosError('connect ETIMEDOUT', 'ETIMEDOUT'),
        'timeout',
      ],
      [
        'an oversized response',
        axiosError(
          'maxContentLength size of 5000000 exceeded',
          'ERR_BAD_RESPONSE',
        ),
        'too_large',
      ],
      [
        'an oversized redirect body',
        axiosError(
          'Request body larger than maxBodyLength limit',
          'ERR_FR_MAX_BODY_LENGTH_EXCEEDED',
        ),
        'too_large',
      ],
      [
        'an upstream 5xx',
        axiosError(
          'Request failed with status code 503',
          'ERR_BAD_RESPONSE',
          503,
        ),
        'upstream_status',
      ],
      [
        'an upstream 404',
        axiosError(
          'Request failed with status code 404',
          'ERR_BAD_REQUEST',
          404,
        ),
        'upstream_status',
      ],
      [
        'an unresolvable host',
        axiosError('getaddrinfo ENOTFOUND missing.example', 'ENOTFOUND'),
        'network',
      ],
      [
        'a refused connection',
        axiosError('connect ECONNREFUSED', 'ECONNREFUSED'),
        'network',
      ],
      ['an error without a known shape', new Error('boom'), 'unknown'],
    ])('classifies %s as %s', async (_label, error, reason) => {
      httpService.get.mockReturnValue(throwError(() => error));
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(
        service.getPreview('https://example.com/failing'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(metrics.recordLinkPreview).toHaveBeenCalledWith('failed', {
        reason,
        durationSeconds: expect.any(Number),
      });
    });

    it('classifies a non-HTML response as not_html', async () => {
      mockHtmlResponse('{}', 'application/json');
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      await expect(
        service.getPreview('https://example.com/data.json'),
      ).rejects.toThrow('URL does not point to an HTML resource');

      expect(metrics.recordLinkPreview).toHaveBeenCalledWith('failed', {
        reason: 'not_html',
        durationSeconds: expect.any(Number),
      });
    });

    it('counts exactly one outcome per request', async () => {
      httpService.get.mockReturnValue(
        throwError(() => axiosError('refused', 'ECONNREFUSED')),
      );
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      await expect(
        service.getPreview('https://example.com/once'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(metrics.recordLinkPreview).toHaveBeenCalledTimes(1);
    });
  });

  describe('failure logging', () => {
    it('logs the bounded reason without URLs or provider messages', async () => {
      const warnSpy = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      httpService.get.mockReturnValue(
        throwError(() =>
          axiosError(
            'connect ETIMEDOUT secret-host.internal token=provider-secret',
            'ETIMEDOUT',
          ),
        ),
      );

      await expect(
        service.getPreview('https://example.com/private?token=super-secret'),
      ).rejects.toBeInstanceOf(BadRequestException);

      const log = warnSpy.mock.calls
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
    it('exposes scrape outcomes, failure reasons and latency on the Prometheus endpoint', async () => {
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
        'hellotalk_link_preview_requests_total{outcome="fetched"} 1',
      );
      expect(output).toContain(
        'hellotalk_link_preview_requests_total{outcome="rejected"} 1',
      );
      expect(output).toContain(
        'hellotalk_link_preview_failures_total{reason="blocked_target"} 1',
      );
      expect(output).toContain(
        'hellotalk_link_preview_fetch_duration_seconds_count{outcome="fetched"} 1',
      );
    });
  });
});
