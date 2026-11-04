import * as http from 'http';
import type { AddressInfo } from 'net';
import { BadRequestException } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { TimeoutError } from 'rxjs';
import {
  classifyLinkPreviewFailure,
  LinkPreviewFailure,
} from './link-preview-diagnostics';

async function withServer(
  handler: http.RequestListener,
  run: (origin: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

/** An origin whose port was just released, so connecting to it is refused. */
async function unusedOrigin(): Promise<string> {
  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return `http://127.0.0.1:${port}`;
}

async function failureOf(request: Promise<unknown>): Promise<unknown> {
  try {
    await request;
  } catch (error: unknown) {
    return error;
  }
  throw new Error('Expected the request to fail');
}

describe('LinkPreviewFailure', () => {
  it('is a 400 so existing callers keep their error contract', () => {
    const failure = new LinkPreviewFailure('Malformed URL', 'invalid_url');

    expect(failure).toBeInstanceOf(BadRequestException);
    expect(failure.getStatus()).toBe(400);
    expect(failure.message).toBe('Malformed URL');
    expect(failure.reason).toBe('invalid_url');
  });
});

describe('classifyLinkPreviewFailure', () => {
  it('reports the reason carried by a policy refusal', () => {
    expect(
      classifyLinkPreviewFailure(
        new LinkPreviewFailure('Private network URLs', 'blocked_target'),
      ),
    ).toBe('blocked_target');
    expect(
      classifyLinkPreviewFailure(
        new LinkPreviewFailure('Not HTML', 'not_html'),
      ),
    ).toBe('not_html');
  });

  it('keeps a policy refusal that axios wrapped in an AxiosError', () => {
    const cause = new LinkPreviewFailure('Redirect blocked', 'blocked_target');
    const wrapped = AxiosError.from(cause);
    // Some axios releases copy the cause's HttpException response onto the
    // wrapper. Simulate it so the ordering guarantee holds on every release:
    // a wrapper that looks like an upstream HTTP response is still a refusal.
    Object.assign(wrapped, { response: cause.getResponse() });

    expect(wrapped.cause).toBe(cause);
    expect(classifyLinkPreviewFailure(wrapped)).toBe('blocked_target');
  });

  it('classifies the hard deadline from rxjs as a timeout', () => {
    expect(classifyLinkPreviewFailure(new TimeoutError())).toBe('timeout');
  });

  it.each([AxiosError.ECONNABORTED, AxiosError.ETIMEDOUT])(
    'classifies axios %s as a timeout',
    (code) => {
      expect(
        classifyLinkPreviewFailure(new AxiosError('timeout of 5000ms', code)),
      ).toBe('timeout');
    },
  );

  it('classifies other transport failures as network', () => {
    expect(
      classifyLinkPreviewFailure(new AxiosError('getaddrinfo', 'ENOTFOUND')),
    ).toBe('network');
  });

  it.each([undefined, null, 'timeout', 42, {}, new Error('provider detail')])(
    'does not guess at unrecognised failures (%s)',
    (error) => {
      expect(classifyLinkPreviewFailure(error)).toBe('unknown');
    },
  );

  it('stops following a self-referencing cause chain', () => {
    const loop = new Error('loop');
    loop.cause = loop;

    expect(classifyLinkPreviewFailure(loop)).toBe('unknown');
  });

  describe('against real axios failures', () => {
    it('classifies a connect or idle timeout', async () => {
      await withServer(
        () => undefined, // never answers
        async (origin) => {
          const error = await failureOf(axios.get(origin, { timeout: 100 }));

          expect(classifyLinkPreviewFailure(error)).toBe('timeout');
        },
      );
    });

    it('classifies an HTTP error status as upstream_status', async () => {
      await withServer(
        (_req, res) => res.writeHead(404).end(),
        async (origin) => {
          const error = await failureOf(axios.get(origin));

          expect(classifyLinkPreviewFailure(error)).toBe('upstream_status');
        },
      );
    });

    it('classifies a declared oversized body as too_large', async () => {
      await withServer(
        (_req, res) => res.end('x'.repeat(2_048)),
        async (origin) => {
          const error = await failureOf(
            axios.get(origin, { maxContentLength: 1_024 }),
          );

          expect(classifyLinkPreviewFailure(error)).toBe('too_large');
        },
      );
    });

    it('classifies a streamed oversized body as too_large', async () => {
      await withServer(
        (_req, res) => {
          res.writeHead(200, { 'content-type': 'text/html' });
          res.write('x'.repeat(2_048));
          res.write('x'.repeat(2_048));
        },
        async (origin) => {
          const error = await failureOf(
            axios.get(origin, {
              maxContentLength: 1_024,
              responseType: 'text',
            }),
          );

          expect(classifyLinkPreviewFailure(error)).toBe('too_large');
        },
      );
    });

    it('classifies a refused connection as network', async () => {
      const closedOrigin = await unusedOrigin();

      const error = await failureOf(axios.get(closedOrigin));

      expect(classifyLinkPreviewFailure(error)).toBe('network');
    });

    it('keeps the policy reason when beforeRedirect rejects the target', async () => {
      await withServer(
        (_req, res) =>
          res.writeHead(302, { location: 'http://127.0.0.1:9/' }).end(),
        async (origin) => {
          const error = await failureOf(
            axios.get(origin, {
              maxRedirects: 3,
              beforeRedirect: () => {
                throw new LinkPreviewFailure(
                  'Private network URLs are not allowed',
                  'blocked_target',
                );
              },
            }),
          );

          expect(classifyLinkPreviewFailure(error)).toBe('blocked_target');
        },
      );
    });
  });
});
