import type { Mock } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import type Redis from 'ioredis';

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

import { LinkPreviewService } from './link-preview.service';

describe('LinkPreviewService security boundaries', () => {
  let service: LinkPreviewService;
  let httpService: { get: Mock };
  let redis: { get: Mock; set: Mock };

  beforeEach(() => {
    httpService = { get: vi.fn() };
    redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };
    service = new LinkPreviewService(
      httpService as unknown as HttpService,
      redis as unknown as Redis,
    );
  });

  afterEach(() => vi.clearAllMocks());

  function mockHtmlResponse(html: string): void {
    httpService.get.mockReturnValue(
      of({ data: html, headers: { 'content-type': 'text/html' } }),
    );
  }

  it('revalidates every redirect target before following it', async () => {
    mockHtmlResponse('<html><head><title>Safe</title></head></html>');

    await service.getPreview('https://example.com/start');

    const requestConfig = httpService.get.mock.calls[0][1] as {
      beforeRedirect?: (options: Record<string, unknown>) => void;
    };
    expect(requestConfig.beforeRedirect).toBeTypeOf('function');

    expect(() =>
      requestConfig.beforeRedirect?.({
        protocol: 'http:',
        hostname: '127.0.0.1',
        port: '80',
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      requestConfig.beforeRedirect?.({
        protocol: 'https:',
        hostname: 'example.com',
        port: '8443',
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      requestConfig.beforeRedirect?.({
        protocol: 'https:',
        hostname: 'example.com',
        port: '443',
        auth: 'user:secret',
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      requestConfig.beforeRedirect?.({
        protocol: 'https:',
        hostname: 'example.com',
        port: '443',
      }),
    ).not.toThrow();
  });

  it('bounds attacker-controlled metadata before it reaches cache or clients', async () => {
    mockHtmlResponse(`
      <html><head>
        <meta property="og:title" content="${'T'.repeat(500)}" />
        <meta property="og:description" content="${'D'.repeat(1_500)}" />
        <meta property="og:site_name" content="${'S'.repeat(300)}" />
      </head></html>
    `);

    const result = await service.getPreview('https://example.com/post');

    expect(result?.title).toHaveLength(300);
    expect(result?.description).toHaveLength(1_000);
    expect(result?.siteName).toHaveLength(200);
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^link_preview:v2:[a-f0-9]{64}$/),
      JSON.stringify(result),
      'EX',
      3_600,
    );
  });

  it('drops overlong image metadata before URL parsing', async () => {
    mockHtmlResponse(`
      <html><head>
        <meta property="og:title" content="Safe" />
        <meta property="og:image" content="https://example.com/${'a'.repeat(2_100)}" />
      </head></html>
    `);

    const result = await service.getPreview('https://example.com/post');

    expect(result?.title).toBe('Safe');
    expect(result?.image).toBe('');
  });
});
