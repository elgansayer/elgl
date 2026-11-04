import type { Mock, MockInstance } from 'vitest';
import * as http from 'http';
import type { AddressInfo } from 'net';
import { BadRequestException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { Observable, of, throwError } from 'rxjs';
import type Redis from 'ioredis';
import type { MetricsService } from '../metrics/metrics.service';
import { LinkPreviewFailure } from './link-preview-diagnostics';
import { LinkPreviewService } from './link-preview.service';

type RequestConfig = {
  httpAgent: http.Agent;
  beforeRedirect: (options: Record<string, unknown>) => void;
  responseType?: string;
};

function upstreamStatusError(status: number): AxiosError {
  const error = new AxiosError(
    `Request failed with status code ${status}`,
    AxiosError.ERR_BAD_RESPONSE,
  );
  return Object.assign(error, { response: { status } });
}

const HTML_RESPONSE = of({
  data: '<html><head><title>Page</title></head></html>',
  headers: { 'content-type': 'text/html' },
});

describe('LinkPreviewService resilience', () => {
  let service: LinkPreviewService;
  let httpService: { get: Mock };
  let redis: { get: Mock; set: Mock };
  let metrics: { recordLinkPreview: Mock };
  let warnSpy: MockInstance;
  let errorSpy: MockInstance;

  beforeEach(() => {
    httpService = { get: vi.fn().mockReturnValue(HTML_RESPONSE) };
    redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };
    metrics = { recordLinkPreview: vi.fn() };
    warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    service = new LinkPreviewService(
      httpService as unknown as HttpService,
      redis as unknown as Redis,
      metrics as unknown as MetricsService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function requestConfig(): RequestConfig {
    return httpService.get.mock.calls[0][1] as RequestConfig;
  }

  function loggedLines(spy: MockInstance): string {
    return spy.mock.calls.map(([message]) => String(message)).join('\n');
  }

  describe('hard fetch deadline', () => {
    it('abandons an origin that never completes and releases the request', async () => {
      vi.useFakeTimers();
      let released = false;
      httpService.get.mockReturnValue(
        new Observable<never>(() => () => {
          released = true;
        }),
      );

      const settled = service
        .getPreview('https://slow.example.com/post?token=secret')
        .then(
          () => undefined,
          (error: unknown) => error,
        );

      await vi.advanceTimersByTimeAsync(7_999);
      expect(released).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      const error = await settled;

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error).toMatchObject({
        message: 'Unable to fetch preview for this URL',
      });
      expect(released).toBe(true);
      expect(redis.set).not.toHaveBeenCalled();
      expect(metrics.recordLinkPreview).toHaveBeenCalledWith('failed', {
        reason: 'timeout',
        durationSeconds: expect.any(Number),
      });
      expect(loggedLines(warnSpy)).toContain('reason=timeout');
      expect(loggedLines(warnSpy)).not.toContain('secret');
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('does not delay an origin that answers promptly', async () => {
      vi.useFakeTimers();

      await expect(
        service.getPreview('https://example.com/'),
      ).resolves.toMatchObject({ title: 'Page' });

      expect(vi.getTimerCount()).toBe(0);
    });

    it('keeps the request body a string so axios never JSON-parses a page', async () => {
      await service.getPreview('https://example.com/');

      expect(requestConfig().responseType).toBe('text');
    });

    describe('against a real slow-drip origin', () => {
      // axios `timeout` is only an idle timer once headers arrive, so an origin
      // that keeps sending a byte inside it was never cut off.
      it('closes the origin connection when the deadline expires', async () => {
        const realService = new LinkPreviewService(
          new HttpService(),
          redis as unknown as Redis,
          metrics as unknown as MetricsService,
        );
        let sentHeaders!: () => void;
        const headersSent = new Promise<void>((resolve) => {
          sentHeaders = resolve;
        });
        let dripTimer: NodeJS.Timeout | undefined;
        let connectionClosed!: () => void;
        const closed = new Promise<void>((resolve) => {
          connectionClosed = resolve;
        });
        const server = http.createServer((_req, res) => {
          res.writeHead(200, { 'content-type': 'text/html' });
          const drip = (): void => {
            res.write('x');
            dripTimer = setTimeout(drip, 20);
          };
          drip();
          sentHeaders();
          res.on('close', connectionClosed);
        });
        await new Promise<void>((resolve) =>
          server.listen(0, '127.0.0.1', resolve),
        );

        try {
          const { port } = server.address() as AddressInfo;
          // Only rxjs's scheduler (setInterval) is faked, so the real socket
          // and the server's setTimeout drip keep running in real time.
          vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
          const settled = realService['fetchPreview'](
            `http://127.0.0.1:${port}/`,
          ).then(
            () => undefined,
            (error: unknown) => error,
          );

          await headersSent;
          await new Promise<void>((resolve) => setTimeout(resolve, 100));
          vi.advanceTimersByTime(8_000);

          expect(await settled).toMatchObject({ name: 'TimeoutError' });
          await closed;
        } finally {
          clearTimeout(dripTimer);
          server.closeAllConnections();
          await new Promise<void>((resolve) => server.close(() => resolve()));
        }
      });
    });
  });

  describe('DNS rebinding guard', () => {
    it('refuses to connect to a hostname that resolves to a loopback address', async () => {
      let connections = 0;
      const server = http.createServer((_req, res) => res.end('internal'));
      server.on('connection', () => {
        connections += 1;
      });
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      );

      try {
        await service.getPreview('https://example.com/');
        const { httpAgent } = requestConfig();
        const { port } = server.address() as AddressInfo;

        const error = await new Promise<unknown>((resolve) => {
          http
            .get({ host: 'localhost', port, path: '/', agent: httpAgent }, () =>
              resolve(undefined),
            )
            .on('error', resolve);
        });

        expect(error).toBeInstanceOf(LinkPreviewFailure);
        expect(error).toMatchObject({ reason: 'blocked_target' });
        expect(connections).toBe(0);
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });

  describe('redirect targets', () => {
    it.each([
      ['a non-http protocol', { protocol: 'ftp:', hostname: 'example.com' }],
      [
        'embedded credentials',
        { protocol: 'https:', hostname: 'example.com', auth: 'user:pass' },
      ],
      [
        'a private literal host',
        { protocol: 'https:', hostname: '10.0.0.5', port: '443' },
      ],
      [
        'a custom port',
        { protocol: 'https:', hostname: 'example.com', port: '8443' },
      ],
      ['a missing host', { protocol: 'https:' }],
    ])('reports %s as blocked_target', async (_label, redirect) => {
      await service.getPreview('https://example.com/');

      let refusal: unknown;
      try {
        requestConfig().beforeRedirect(redirect);
      } catch (error: unknown) {
        refusal = error;
      }

      expect(refusal).toBeInstanceOf(LinkPreviewFailure);
      expect(refusal).toMatchObject({ reason: 'blocked_target' });
    });
  });

  describe('metrics and failure logging', () => {
    it.each([
      ['not a url', 'invalid_url'],
      [`https://example.com/${'a'.repeat(2_100)}`, 'invalid_url'],
      ['ftp://example.com/file', 'invalid_url'],
      ['https://user:pass@example.com/', 'invalid_url'],
      ['https://example.com:8443/', 'blocked_target'],
      ['http://localhost/', 'blocked_target'],
      ['http://169.254.169.254/latest/meta-data/', 'blocked_target'],
    ])(
      'counts %s as rejected (%s) without touching the network',
      async (url, reason) => {
        await expect(service.getPreview(url)).rejects.toBeInstanceOf(
          BadRequestException,
        );

        expect(metrics.recordLinkPreview).toHaveBeenCalledTimes(1);
        expect(metrics.recordLinkPreview).toHaveBeenCalledWith('rejected', {
          reason,
        });
        expect(httpService.get).not.toHaveBeenCalled();
        expect(redis.get).not.toHaveBeenCalled();
      },
    );

    it('counts a validated cache entry as a cache hit', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({
          url: 'https://example.com/',
          title: 'Cached',
          description: '',
          image: '',
          siteName: 'example.com',
        }),
      );

      await service.getPreview('https://example.com/');

      expect(metrics.recordLinkPreview).toHaveBeenCalledTimes(1);
      expect(metrics.recordLinkPreview).toHaveBeenCalledWith('cache_hit');
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('does not count an unusable cache entry as a hit', async () => {
      redis.get.mockResolvedValue('{not json');

      await service.getPreview('https://example.com/');

      expect(metrics.recordLinkPreview).toHaveBeenCalledTimes(1);
      expect(metrics.recordLinkPreview).toHaveBeenCalledWith('fetched', {
        durationSeconds: expect.any(Number),
      });
      expect(loggedLines(warnSpy)).toContain(
        'Invalid link-preview cache entry',
      );
    });

    it('counts a scraped preview as fetched with its duration', async () => {
      await service.getPreview('https://example.com/');

      expect(metrics.recordLinkPreview).toHaveBeenCalledTimes(1);
      expect(metrics.recordLinkPreview).toHaveBeenCalledWith('fetched', {
        durationSeconds: expect.any(Number),
      });
    });

    it('counts a page without usable metadata as empty and does not cache it', async () => {
      httpService.get.mockReturnValue(
        of({
          data: '<html><body>No metadata</body></html>',
          headers: { 'content-type': 'text/html' },
        }),
      );

      await expect(
        service.getPreview('https://example.com/'),
      ).resolves.toBeNull();

      expect(metrics.recordLinkPreview).toHaveBeenCalledWith('empty', {
        durationSeconds: expect.any(Number),
      });
      expect(redis.set).not.toHaveBeenCalled();
    });

    it.each([
      [
        'a non-HTML resource',
        of({ data: '{}', headers: { 'content-type': 'application/json' } }),
        'not_html',
      ],
      [
        'an upstream HTTP error',
        throwError(() => upstreamStatusError(503)),
        'upstream_status',
      ],
      [
        'an axios timeout',
        throwError(
          () => new AxiosError('timeout of 5000ms', AxiosError.ECONNABORTED),
        ),
        'timeout',
      ],
      [
        'a refused connection',
        throwError(() => new AxiosError('connect', 'ECONNREFUSED')),
        'network',
      ],
      [
        'an oversized page',
        throwError(
          () =>
            new AxiosError(
              'maxContentLength size of 5000000 exceeded',
              AxiosError.ERR_BAD_RESPONSE,
            ),
        ),
        'too_large',
      ],
    ])(
      'counts %s as failed (%s) and logs a warning',
      async (_label, response, reason) => {
        httpService.get.mockReturnValue(response);

        await expect(
          service.getPreview('https://example.com/private?token=secret'),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(metrics.recordLinkPreview).toHaveBeenCalledTimes(1);
        expect(metrics.recordLinkPreview).toHaveBeenCalledWith('failed', {
          reason,
          durationSeconds: expect.any(Number),
        });
        expect(loggedLines(warnSpy)).toContain(`reason=${reason}`);
        expect(loggedLines(warnSpy)).toContain('example.com#');
        expect(loggedLines(warnSpy)).not.toContain('secret');
        expect(errorSpy).not.toHaveBeenCalled();
        expect(redis.set).not.toHaveBeenCalled();
      },
    );

    it('logs an unclassified failure as an error without leaking the provider message', async () => {
      httpService.get.mockReturnValue(
        throwError(() => new Error('provider leaked token=provider-secret')),
      );

      await expect(
        service.getPreview('https://example.com/private?token=secret'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(metrics.recordLinkPreview).toHaveBeenCalledWith('failed', {
        reason: 'unknown',
        durationSeconds: expect.any(Number),
      });
      expect(loggedLines(errorSpy)).toContain('reason=unknown');
      expect(loggedLines(errorSpy)).not.toContain('provider-secret');
      expect(loggedLines(errorSpy)).not.toContain('secret');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('keeps the HTML-only message for callers', async () => {
      httpService.get.mockReturnValue(
        of({ data: 'binary', headers: { 'content-type': 'image/png' } }),
      );

      await expect(
        service.getPreview('https://example.com/logo.png'),
      ).rejects.toMatchObject({
        message: 'URL does not point to an HTML resource',
      });
    });
  });
});
