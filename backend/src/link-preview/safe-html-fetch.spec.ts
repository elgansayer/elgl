import { HttpService } from '@nestjs/axios';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import type { AddressInfo } from 'net';
import { of } from 'rxjs';
import { Readable } from 'stream';
import {
  BlockedAddressError,
  createGuardedAgents,
  fetchHtml,
  guardedLookup,
  GuardedLookup,
  LINK_PREVIEW_USER_AGENT,
  MAX_HTML_BYTES,
  NotHtmlResponseError,
} from './safe-html-fetch';
import { UnsafeLinkPreviewUrlError } from './link-preview-url';

/**
 * Real-socket tests: they start local HTTP servers and drive the production
 * fetch code against them. Names ending in `.test` resolve to 127.0.0.1 through
 * an injected lookup so a "public" hostname can be pointed at a local server;
 * everything else still goes through the production guarded lookup.
 */
const localTestLookup: GuardedLookup = (hostname, options, callback) => {
  if (hostname.endsWith('.test')) {
    const wantsAll = typeof options === 'object' && options.all === true;
    if (wantsAll) {
      callback(null, [{ address: '127.0.0.1', family: 4 }], 4);
    } else {
      callback(null, '127.0.0.1', 4);
    }
    return;
  }
  guardedLookup(hostname, options, callback);
};

interface LocalServer {
  port: number;
  server: http.Server;
  requests: http.IncomingMessage[];
}

const servers: http.Server[] = [];

async function startServer(
  handler: http.RequestListener,
): Promise<LocalServer> {
  const requests: http.IncomingMessage[] = [];
  const server = http.createServer((req, res) => {
    requests.push(req);
    handler(req, res);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return { port: address.port, server, requests };
}

function causeChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  let current: unknown = error;
  while (current && chain.length < 8) {
    chain.push(current);
    current = current instanceof Error ? current.cause : undefined;
  }
  return chain;
}

describe('fetchHtml (real sockets)', () => {
  const httpService = new HttpService();
  const agents = createGuardedAgents(localTestLookup);

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve) => {
            server.closeAllConnections();
            server.close(() => resolve());
          }),
      ),
    );
  });

  it('downloads an HTML page and reports its type and final address', async () => {
    const local = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<html><head><title>Hello</title></head></html>');
    });
    const url = `http://page.test:${local.port}/article`;

    const result = await fetchHtml(httpService, url, { agents });

    expect(Buffer.isBuffer(result.body)).toBe(true);
    expect(result.body.toString()).toContain('<title>Hello</title>');
    expect(result.contentType).toBe('text/html; charset=utf-8');
    expect(result.finalUrl).toBe(url);
  });

  it('identifies itself and asks only for HTML', async () => {
    const local = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html></html>');
    });

    await fetchHtml(httpService, `http://page.test:${local.port}/`, {
      agents,
    });

    const headers = local.requests[0]?.headers;
    expect(headers?.['user-agent']).toBe(LINK_PREVIEW_USER_AGENT);
    expect(headers?.accept).toContain('text/html');
  });

  it('accepts XHTML documents', async () => {
    const local = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/xhtml+xml' });
      res.end('<html xmlns="http://www.w3.org/1999/xhtml"></html>');
    });

    await expect(
      fetchHtml(httpService, `http://page.test:${local.port}/`, { agents }),
    ).resolves.toMatchObject({ contentType: 'application/xhtml+xml' });
  });

  it('rejects non-HTML responses and closes the connection', async () => {
    let closed = false;
    const local = await startServer((_req, res) => {
      res.on('close', () => {
        closed = true;
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.write('{"secret":true}');
      // Never ends: only the client abandoning the body can close this socket.
    });

    await expect(
      fetchHtml(httpService, `http://page.test:${local.port}/data`, { agents }),
    ).rejects.toBeInstanceOf(NotHtmlResponseError);

    await vi.waitFor(() => expect(closed).toBe(true));
  });

  it('reads only the first MAX_HTML_BYTES of an oversized page and drops the connection', async () => {
    const payloadBytes = 16 * 1024 * 1024;
    let sentBytes = 0;
    let clientGone = false;
    const local = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.on('close', () => {
        clientGone = true;
      });
      const head = '<html><head><title>Huge page</title></head><body>';
      const chunk = Buffer.alloc(64 * 1024, 'x');
      res.write(head);
      sentBytes += head.length;
      const pump = (): void => {
        while (!clientGone && sentBytes < payloadBytes) {
          sentBytes += chunk.length;
          if (!res.write(chunk)) {
            res.once('drain', pump);
            return;
          }
        }
        if (!clientGone) {
          res.end();
        }
      };
      pump();
    });

    const result = await fetchHtml(
      httpService,
      `http://page.test:${local.port}/huge`,
      { agents },
    );

    expect(result.body.length).toBe(MAX_HTML_BYTES);
    expect(result.body.toString('utf8', 0, 64)).toContain('<title>Huge page');
    await vi.waitFor(() => expect(clientGone).toBe(true));
    expect(sentBytes).toBeLessThan(payloadBytes);
  });

  it('cuts off an origin that trickles bytes forever once the deadline passes', async () => {
    let clientGone = false;
    const local = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.write('<html><head><title>Slow</title>');
      const timer = setInterval(() => res.write(' '), 40);
      res.on('close', () => {
        clientGone = true;
        clearInterval(timer);
      });
    });
    const started = Date.now();

    const error = await fetchHtml(
      httpService,
      `http://slow.test:${local.port}/drip`,
      { agents, deadlineMs: 400 },
    ).then(
      () => null,
      (rejection: unknown) => rejection,
    );

    expect(error).toBeInstanceOf(Error);
    expect(Date.now() - started).toBeLessThan(3_000);
    await vi.waitFor(() => expect(clientGone).toBe(true));
  });

  it('stops waiting for an origin that never answers once the deadline passes', async () => {
    const local = await startServer(() => {
      // Accept the request and never respond.
    });
    const started = Date.now();

    await expect(
      fetchHtml(httpService, `http://silent.test:${local.port}/`, {
        agents,
        deadlineMs: 300,
      }),
    ).rejects.toBeInstanceOf(Error);
    expect(Date.now() - started).toBeLessThan(3_000);
  });

  it('refuses to follow a redirect to a private IP literal and never contacts it', async () => {
    const internal = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><head><title>INTERNAL SECRET</title></head></html>');
    });
    const redirector = await startServer((_req, res) => {
      // Default-port IP literals, so only the private-host rule can reject them.
      res.writeHead(302, { location: 'http://127.0.0.1/admin' });
      res.end();
    });

    const error = await fetchHtml(
      httpService,
      `http://public.test:${redirector.port}/`,
      { agents },
    ).then(
      () => null,
      (rejection: unknown) => rejection,
    );

    const policyError = causeChain(error).find(
      (candidate) => candidate instanceof UnsafeLinkPreviewUrlError,
    );
    expect(policyError).toMatchObject({ reason: 'private_host' });
    expect(internal.requests).toHaveLength(0);
  });

  it.each([
    ['cloud metadata address', 'http://169.254.169.254/latest/meta-data/'],
    ['IPv6 loopback', 'http://[::1]/'],
    ['IPv4-mapped IPv6 loopback', 'http://[::ffff:7f00:1]/'],
    ['private network address', 'http://10.0.0.5/admin'],
    ['non-public alias', 'http://intranet/'],
  ])('refuses a redirect to the %s', async (_label, location) => {
    const redirector = await startServer((_req, res) => {
      res.writeHead(302, { location });
      res.end();
    });

    const error = await fetchHtml(
      httpService,
      `http://public.test:${redirector.port}/`,
      { agents },
    ).then(
      () => null,
      (rejection: unknown) => rejection,
    );

    expect(
      causeChain(error).some(
        (candidate) => candidate instanceof UnsafeLinkPreviewUrlError,
      ),
    ).toBe(true);
  });

  it.each([
    ['a non-default port', 'http://public.test:8080/next', 'port'],
    [
      'embedded credentials',
      'http://user:pass@public.test/next',
      'credentials',
    ],
    ['a non-http protocol', 'ftp://public.test/next', 'protocol'],
  ])('refuses a redirect with %s', async (_label, location, reason) => {
    const redirector = await startServer((_req, res) => {
      res.writeHead(302, { location });
      res.end();
    });

    const error = await fetchHtml(
      httpService,
      `http://public.test:${redirector.port}/`,
      { agents },
    ).then(
      () => null,
      (rejection: unknown) => rejection,
    );

    expect(
      causeChain(error).find(
        (candidate) => candidate instanceof UnsafeLinkPreviewUrlError,
      ),
    ).toMatchObject({ reason });
  });

  it('refuses a hostname that resolves to a loopback address through the production lookup', async () => {
    const local = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><head><title>Should not be reached</title></head></html>');
    });

    const error = await fetchHtml(
      httpService,
      `http://localhost:${local.port}/`,
      { agents: createGuardedAgents() },
    ).then(
      () => null,
      (rejection: unknown) => rejection,
    );

    expect(
      causeChain(error).some(
        (candidate) => candidate instanceof BlockedAddressError,
      ),
    ).toBe(true);
    expect(local.requests).toHaveLength(0);
  });

  it('ignores proxy environment variables so name resolution stays guarded', async () => {
    const local = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><head><title>Direct</title></head></html>');
    });
    const saved = {
      HTTP_PROXY: process.env.HTTP_PROXY,
      http_proxy: process.env.http_proxy,
      NO_PROXY: process.env.NO_PROXY,
      no_proxy: process.env.no_proxy,
    };
    // Nothing listens on port 1: a proxied request would fail to connect.
    process.env.HTTP_PROXY = 'http://127.0.0.1:1';
    process.env.http_proxy = 'http://127.0.0.1:1';
    process.env.NO_PROXY = '';
    process.env.no_proxy = '';

    try {
      const result = await fetchHtml(
        httpService,
        `http://page.test:${local.port}/`,
        { agents },
      );
      expect(result.body.toString()).toContain('Direct');
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});

describe('fetchHtml redirects between public hosts (real sockets)', () => {
  const httpService = new HttpService();

  /**
   * Every connection goes to the local server no matter what the URL says, so
   * ordinary default-port "public" hostnames can be used end to end. The URL
   * policy still sees only those public-looking addresses and must allow them.
   */
  function routeTo(port: number) {
    const httpAgent = Object.assign(new http.Agent(), {
      createConnection: () => net.createConnection({ host: '127.0.0.1', port }),
    });
    return { httpAgent, httpsAgent: new https.Agent() };
  }

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve) => {
            server.closeAllConnections();
            server.close(() => resolve());
          }),
      ),
    );
  });

  it('follows a redirect to another public host and reports where the page finally came from', async () => {
    const local = await startServer((req, res) => {
      if (req.headers.host === 'short.test') {
        res.writeHead(302, {
          location: 'http://www.target.test/landing?ref=1',
        });
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<html><head><title>Landed</title></head></html>');
    });

    const result = await fetchHtml(httpService, 'http://short.test/abc', {
      agents: routeTo(local.port),
    });

    expect(result.body.toString()).toContain('<title>Landed</title>');
    expect(result.finalUrl).toBe('http://www.target.test/landing?ref=1');
    expect(local.requests.map((request) => request.headers.host)).toEqual([
      'short.test',
      'www.target.test',
    ]);
    expect(local.requests[1]?.url).toBe('/landing?ref=1');
  });

  it('follows relative redirects on the same host', async () => {
    const local = await startServer((req, res) => {
      if (req.url === '/start') {
        res.writeHead(301, { location: '/moved' });
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><head><title>Moved</title></head></html>');
    });

    const result = await fetchHtml(httpService, 'http://site.test/start', {
      agents: routeTo(local.port),
    });

    expect(result.finalUrl).toBe('http://site.test/moved');
  });

  it('gives up after three redirects and never requests a fifth page', async () => {
    const local = await startServer((_req, res) => {
      res.writeHead(302, { location: 'http://loop.test/next' });
      res.end();
    });

    const error = await fetchHtml(httpService, 'http://loop.test/start', {
      agents: routeTo(local.port),
    }).then(
      () => null,
      (rejection: unknown) => rejection,
    );

    expect(error).toBeInstanceOf(Error);
    // The first request plus three redirects.
    expect(local.requests).toHaveLength(4);
  });

  it('reports an HTTP error status from the final page as a failure', async () => {
    const local = await startServer((_req, res) => {
      res.writeHead(404, { 'content-type': 'text/html' });
      res.end('<html><head><title>Not found</title></head></html>');
    });

    await expect(
      fetchHtml(httpService, 'http://missing.test/page', {
        agents: routeTo(local.port),
      }),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });
});

describe('fetchHtml request configuration', () => {
  function captureConfig(response: unknown): {
    httpService: HttpService;
    calls: Array<{ url: string; config: Record<string, unknown> }>;
  } {
    const calls: Array<{ url: string; config: Record<string, unknown> }> = [];
    const get = vi.fn((url: string, config: Record<string, unknown>) => {
      calls.push({ url, config });
      return of(response);
    });
    return { httpService: { get } as unknown as HttpService, calls };
  }

  it('applies the bounded, proxy-free request contract', async () => {
    const { httpService, calls } = captureConfig({
      data: Readable.from(['<html></html>']),
      headers: { 'content-type': 'text/html' },
    });

    await fetchHtml(httpService, 'https://example.com/');

    const config = calls[0]?.config ?? {};
    expect(config).toMatchObject({
      responseType: 'stream',
      timeout: 5_000,
      maxRedirects: 3,
      proxy: false,
    });
    expect(config.httpAgent).toBeInstanceOf(http.Agent);
    expect(config.signal).toBeInstanceOf(AbortSignal);
    expect(typeof config.beforeRedirect).toBe('function');
  });

  it('lets redirects to ordinary public pages continue', async () => {
    const { httpService, calls } = captureConfig({
      data: Readable.from(['<html></html>']),
      headers: { 'content-type': 'text/html' },
    });
    await fetchHtml(httpService, 'https://example.com/');
    const beforeRedirect = calls[0]?.config.beforeRedirect as (
      options: Record<string, unknown>,
    ) => void;

    expect(() =>
      beforeRedirect({ href: 'https://www.example.com/landing?ref=1' }),
    ).not.toThrow();
    expect(() =>
      beforeRedirect({ href: 'https://example.org:443/' }),
    ).not.toThrow();
  });

  it('aborts redirects whose target is unsafe or unreadable', async () => {
    const { httpService, calls } = captureConfig({
      data: Readable.from(['<html></html>']),
      headers: { 'content-type': 'text/html' },
    });
    await fetchHtml(httpService, 'https://example.com/');
    const beforeRedirect = calls[0]?.config.beforeRedirect as (
      options: Record<string, unknown>,
    ) => void;

    expect(() => beforeRedirect({ href: 'http://169.254.169.254/' })).toThrow(
      UnsafeLinkPreviewUrlError,
    );
    expect(() => beforeRedirect({ href: 'http://localhost/' })).toThrow(
      UnsafeLinkPreviewUrlError,
    );
    expect(() => beforeRedirect({})).toThrow(UnsafeLinkPreviewUrlError);
    expect(() => beforeRedirect({ href: 42 })).toThrow(
      UnsafeLinkPreviewUrlError,
    );
  });

  it('accepts a body that an adapter already buffered', async () => {
    const { httpService } = captureConfig({
      data: '<html><head><title>Pre-decoded</title></head></html>',
      headers: { 'content-type': 'text/html' },
    });

    const result = await fetchHtml(httpService, 'https://example.com/');

    expect(result.body).toBe(
      '<html><head><title>Pre-decoded</title></head></html>',
    );
  });

  it('applies the byte cap to a body that an adapter already buffered', async () => {
    const { httpService } = captureConfig({
      data: 'x'.repeat(MAX_HTML_BYTES + 500),
      headers: { 'content-type': 'text/html' },
    });

    const result = await fetchHtml(httpService, 'https://example.com/');

    expect(result.body.length).toBe(MAX_HTML_BYTES);
  });

  it('resolves relative addresses against the final URL after redirects', async () => {
    const { httpService } = captureConfig({
      data: Readable.from(['<html></html>']),
      headers: { 'content-type': 'text/html' },
      request: { res: { responseUrl: 'https://www.example.com/landing' } },
    });

    const result = await fetchHtml(httpService, 'https://short.example/abc');

    expect(result.finalUrl).toBe('https://www.example.com/landing');
  });

  it('falls back to the requested URL when the final URL is not usable', async () => {
    const { httpService } = captureConfig({
      data: Readable.from(['<html></html>']),
      headers: { 'content-type': 'text/html' },
      request: { res: { responseUrl: 'http://127.0.0.1/internal' } },
    });

    const result = await fetchHtml(httpService, 'https://example.com/page');

    expect(result.finalUrl).toBe('https://example.com/page');
  });
});
