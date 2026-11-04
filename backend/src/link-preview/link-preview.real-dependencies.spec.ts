// Deliberately mocks none of cheerio, DOMPurify or JSDOM. The other link-preview
// specs swap DOMPurify for a regex stand-in, so this is the only suite that
// proves the installed parsing and sanitising libraries behave as the scraper
// assumes.
import type { Mock } from 'vitest';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import type Redis from 'ioredis';
import type { MetricsService } from '../metrics/metrics.service';
import { LinkPreviewService } from './link-preview.service';

const PAGE_URL = 'https://example.com/post';

/** Escapes a value for a double-quoted attribute so cheerio decodes it back. */
function attr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

describe('LinkPreviewService with the real cheerio, DOMPurify and JSDOM', () => {
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
      { recordLinkPreview: vi.fn() } as unknown as MetricsService,
    );
  });

  function serve(head: string, body = ''): void {
    httpService.get.mockReturnValue(
      of({
        data: `<!doctype html><html><head>${head}</head><body>${body}</body></html>`,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    );
  }

  it('extracts OpenGraph metadata and decodes HTML entities', async () => {
    serve(`
      <meta property="og:title" content="Tom &amp; Jerry &#8211; &quot;Best&quot; episodes" />
      <meta property="og:description" content="Cat &amp; mouse &lt;3" />
      <meta property="og:image" content="/img/cover.png" />
      <meta property="og:site_name" content="Cartoon &amp; Co" />
    `);

    await expect(service.getPreview(PAGE_URL)).resolves.toEqual({
      url: PAGE_URL,
      title: 'Tom & Jerry – "Best" episodes',
      description: 'Cat & mouse <3',
      image: 'https://example.com/img/cover.png',
      siteName: 'Cartoon & Co',
    });
  });

  it('reads tags declared with name instead of property', async () => {
    serve(`
      <meta name="og:title" content="Named title" />
      <meta name="og:description" content="Named description" />
    `);

    const preview = await service.getPreview(PAGE_URL);

    expect(preview?.title).toBe('Named title');
    expect(preview?.description).toBe('Named description');
  });

  it('falls back to the document title, description and hostname', async () => {
    serve(`
      <title>  Plain   page  </title>
      <meta name="description" content="Plain description" />
    `);

    const preview = await service.getPreview(PAGE_URL);

    expect(preview).toMatchObject({
      title: 'Plain   page',
      description: 'Plain description',
      siteName: 'example.com',
      image: '',
    });
  });

  it('uses only the document title, not the titles of inline SVG icons', async () => {
    serve(
      '<title>Real page title</title>',
      '<button><svg><title>Close menu</title></svg></button><svg><title>Cart icon</title></svg>',
    );

    const preview = await service.getPreview(PAGE_URL);

    expect(preview?.title).toBe('Real page title');
  });

  it.each([
    ['an event handler', '<img src=x onerror=alert(1)>Title', 'Title'],
    ['a script element', '<script>alert(1)</script>Title', 'Title'],
    [
      'a nested svg script',
      '<svg><script>alert(1)</script></svg>Title',
      'Title',
    ],
    [
      'a javascript: frame',
      '<iframe src="javascript:alert(1)"></iframe>Title',
      'Title',
    ],
    [
      'a javascript: link',
      '<a href="javascript:alert(1)">Click</a> me',
      'Click me',
    ],
    ['a style element', '<style>body{display:none}</style>Title', 'Title'],
    ['formatting tags', '<b>bold</b> and <i>italic</i>', 'bold and italic'],
  ])(
    'strips %s from the title, description and site name',
    async (_label, payload, expected) => {
      serve(`
      <meta property="og:title" content="${attr(payload)}" />
      <meta property="og:description" content="${attr(payload)}" />
      <meta property="og:site_name" content="${attr(payload)}" />
    `);

      const preview = await service.getPreview(PAGE_URL);

      expect(preview).toMatchObject({
        title: expected,
        description: expected,
        siteName: expected,
      });
    },
  );

  it('returns no preview, and caches nothing, when sanitising leaves nothing usable', async () => {
    // Mutation-XSS vector: every element and comment collapses to nothing.
    const vector =
      '<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;img src=1 onerror=alert(1)&gt;">';
    serve(`
      <meta property="og:title" content="${attr(vector)}" />
      <meta property="og:description" content="${attr(vector)}" />
    `);

    await expect(service.getPreview(PAGE_URL)).resolves.toBeNull();

    expect(redis.set).not.toHaveBeenCalled();
  });

  it('returns markup-looking text as inert plain text, never as markup', async () => {
    serve(`
      <meta property="og:title" content="${attr('&lt;script&gt;alert(1)&lt;/script&gt;Title')}" />
    `);

    const preview = await service.getPreview(PAGE_URL);

    // Double-encoded input is text, so it is kept as text. Consumers must bind
    // it as text (the Angular card does) and never as HTML.
    expect(preview?.title).toBe('<script>alert(1)</script>Title');
  });

  it('preserves multilingual and right-to-left text exactly', async () => {
    const title = '日本語のタイトル 🌸 العنوان بالعربية Привет, мир';
    serve(`<meta property="og:title" content="${attr(title)}" />`);

    const preview = await service.getPreview(PAGE_URL);

    expect(preview?.title).toBe(title);
  });

  it('bounds field lengths on the real sanitiser output', async () => {
    serve(`
      <meta property="og:title" content="${'t'.repeat(400)}" />
      <meta property="og:description" content="${'d'.repeat(1_200)}" />
      <meta property="og:site_name" content="${'s'.repeat(250)}" />
    `);

    const preview = await service.getPreview(PAGE_URL);

    expect(preview?.title).toHaveLength(300);
    expect(preview?.description).toHaveLength(1_000);
    expect(preview?.siteName).toHaveLength(200);
  });

  it('drops unsafe image URLs but keeps the rest of the preview', async () => {
    serve(`
      <meta property="og:title" content="Safe" />
      <meta property="og:image" content="javascript:alert(1)" />
    `);

    await expect(service.getPreview(PAGE_URL)).resolves.toMatchObject({
      title: 'Safe',
      image: '',
    });
  });

  it('re-sanitises a poisoned cache entry before returning it', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({
        url: PAGE_URL,
        title: '<img src=x onerror=alert(1)>Cached',
        description: '<script>alert(1)</script>Description',
        image: 'javascript:alert(1)',
        siteName: '<b>Cached site</b>',
      }),
    );

    await expect(service.getPreview(PAGE_URL)).resolves.toEqual({
      url: PAGE_URL,
      title: 'Cached',
      description: 'Description',
      image: '',
      siteName: 'Cached site',
    });
    expect(httpService.get).not.toHaveBeenCalled();
  });

  it('caches exactly what it returns', async () => {
    serve(
      `<meta property="og:title" content="${attr('<b>Bold</b> title')}" />`,
    );

    const preview = await service.getPreview(PAGE_URL);

    expect(preview?.title).toBe('Bold title');
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^link_preview:v2:[a-f0-9]{64}$/),
      JSON.stringify(preview),
      'EX',
      3_600,
    );
  });
});
