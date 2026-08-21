import type { Mock } from 'vitest';
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
  const mockSanitize = (dirty: string): string => {
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
  return { mockSanitize };
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
import { BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { LinkPreviewService } from './link-preview.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('LinkPreviewService', () => {
  let service: LinkPreviewService;
  let httpService: { get: Mock };
  let redis: { get: Mock; set: Mock };

  beforeEach(async () => {
    redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };

    httpService = {
      get: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkPreviewService,
        { provide: HttpService, useValue: httpService },
        {
          provide: SupabaseService,
          useValue: { getRedisClient: vi.fn().mockReturnValue(redis) },
        },
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

  it('rejects a malformed URL', async () => {
    await expect(service.getPreview('not a url')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(httpService.get).not.toHaveBeenCalled();
  });

  it('rejects SSRF attempts via local IPs (localhost)', async () => {
    httpService.get.mockReturnValue(
      throwError(
        () => new Error('SSRF blocked: Private IP 127.0.0.1 is not allowed.'),
      ),
    );

    await expect(service.getPreview('http://localhost')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects SSRF attempts via cloud metadata IPs', async () => {
    httpService.get.mockReturnValue(
      throwError(
        () =>
          new Error('SSRF blocked: Private IP 169.254.169.254 is not allowed.'),
      ),
    );

    await expect(
      service.getPreview('http://169.254.169.254/latest/meta-data/'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects SSRF attempts via private network IPs', async () => {
    httpService.get.mockReturnValue(
      throwError(
        () => new Error('SSRF blocked: Private IP 192.168.1.1 is not allowed.'),
      ),
    );

    await expect(
      service.getPreview('http://192.168.1.1/admin'),
    ).rejects.toBeInstanceOf(BadRequestException);
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

  it('returns a cached preview without hitting the network', async () => {
    const cached = {
      url: 'https://example.com/',
      title: 'Cached title',
      siteName: 'example.com',
    };
    redis.get.mockResolvedValue(JSON.stringify(cached));

    const result = await service.getPreview('https://example.com');

    expect(result).toEqual(cached);
    expect(httpService.get).not.toHaveBeenCalled();
  });

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
      'link_preview:https://example.com/post',
      JSON.stringify(result),
      'EX',
      3600,
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

    expect(result.title).toBe('Fallback Title');
    expect(result.description).toBe('Fallback description');
    expect(result.siteName).toBe('example.com');
  });

  it('strips markup from scraped fields', async () => {
    mockHtmlResponse(`
      <html><head>
        <meta property="og:title" content="&lt;script&gt;alert(1)&lt;/script&gt;Title" />
      </head></html>
    `);

    const result = await service.getPreview('https://example.com/');

    expect(result.title).toBe('Title');
  });

  it('sanitizes malicious HTML inputs safely', async () => {
    mockHtmlResponse(`
      <html><head>
        <meta property="og:title" content="Hello &lt;b onmouseover=&quot;alert()&quot;&gt;World&lt;/b&gt;" />
      </head></html>
    `);

    const result = await service.getPreview('https://example.com/');

    expect(result.title).toBe('Hello World');
  });

  it('rejects non-HTML responses', async () => {
    mockHtmlResponse('{}', 'application/json');

    await expect(
      service.getPreview('https://example.com/data.json'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bounds the response size to prevent memory exhaustion', async () => {
    mockHtmlResponse('<html><head><title>Hello</title></head></html>');

    await service.getPreview('https://example.com/');

    const requestConfig = httpService.get.mock.calls[0][1];
    expect(requestConfig.maxContentLength).toBe(5_000_000);
    expect(requestConfig.maxBodyLength).toBe(5_000_000);
  });

  it('wraps network failures in a BadRequestException', async () => {
    httpService.get.mockReturnValue(throwError(() => new Error('timeout')));

    await expect(
      service.getPreview('https://unreachable.example.com'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
