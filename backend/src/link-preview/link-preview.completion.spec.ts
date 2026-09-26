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
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { LinkPreviewService } from './link-preview.service';
import { MetricsService } from '../metrics/metrics.service';

describe('LinkPreviewService completion boundaries', () => {
  let service: LinkPreviewService;
  let httpService: { get: Mock };
  let redis: { get: Mock; set: Mock };

  beforeEach(async () => {
    httpService = { get: vi.fn() };
    redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkPreviewService,
        { provide: HttpService, useValue: httpService },
        {
          provide: MetricsService,
          useValue: {
            recordLinkPreviewRequest: vi.fn(),
            observeLinkPreviewFetch: vi.fn(),
            setLinkPreviewInflightFetches: vi.fn(),
          },
        },
        { provide: 'REDIS_CLIENT', useValue: redis },
      ],
    }).compile();

    service = module.get(LinkPreviewService);
  });

  afterEach(() => vi.clearAllMocks());

  it('returns null without caching a preview when an HTML page exposes no preview metadata', async () => {
    httpService.get.mockReturnValue(
      of({
        data: '<html><head></head><body>Body only</body></html>',
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    );

    await expect(
      service.getPreview('https://example.com/empty'),
    ).resolves.toBeNull();

    expect(httpService.get).toHaveBeenCalledTimes(1);
    // Only a short-lived negative entry is written; no preview is ever cached.
    expect(redis.set).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('link_preview:v2:negative:'),
      JSON.stringify({ kind: 'empty' }),
      'EX',
      300,
    );
  });

  it('keeps every origin scrape bounded by timeout, deadline, redirects and proxy policy', async () => {
    httpService.get.mockReturnValue(
      of({
        data: '<html><head><title>Bounded fetch</title></head></html>',
        headers: { 'content-type': 'text/html' },
      }),
    );

    await service.getPreview('https://example.com/');

    expect(httpService.get).toHaveBeenCalledWith(
      'https://example.com/',
      expect.objectContaining({
        responseType: 'stream',
        timeout: 5_000,
        maxRedirects: 3,
        proxy: false,
        signal: expect.any(AbortSignal),
        beforeRedirect: expect.any(Function),
        httpAgent: expect.anything(),
        httpsAgent: expect.anything(),
      }),
    );
  });
});
