import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { LinkPreviewService } from './link-preview.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('LinkPreviewService', () => {
  let service: LinkPreviewService;
  let httpService: { get: jest.Mock };
  let redis: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };

    httpService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkPreviewService,
        { provide: HttpService, useValue: httpService },
        {
          provide: SupabaseService,
          useValue: { getRedisClient: jest.fn().mockReturnValue(redis) },
        },
        { provide: 'REDIS_CLIENT', useValue: redis },
      ],
    }).compile();

    service = module.get(LinkPreviewService);
  });

  afterEach(() => jest.clearAllMocks());

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

  it('rejects non-HTML responses', async () => {
    mockHtmlResponse('{}', 'application/json');

    await expect(
      service.getPreview('https://example.com/data.json'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('wraps network failures in a BadRequestException', async () => {
    httpService.get.mockReturnValue(throwError(() => new Error('timeout')));

    await expect(
      service.getPreview('https://unreachable.example.com'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
