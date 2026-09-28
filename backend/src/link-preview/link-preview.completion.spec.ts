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
        { provide: 'REDIS_CLIENT', useValue: redis },
      ],
    }).compile();

    service = module.get(LinkPreviewService);
  });

  afterEach(() => vi.clearAllMocks());

  it('returns null without caching when an HTML page exposes no preview metadata', async () => {
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
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('keeps every origin scrape bounded by timeout, redirects, and response size', async () => {
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
        timeout: 5_000,
        maxRedirects: 3,
        maxContentLength: 5_000_000,
        maxBodyLength: 5_000_000,
        httpAgent: expect.anything(),
        httpsAgent: expect.anything(),
      }),
    );
  });
});
