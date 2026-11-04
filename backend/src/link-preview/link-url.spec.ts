import { extractFirstHttpUrl } from './link-url';

describe('extractFirstHttpUrl', () => {
  it('returns null when the text contains no http(s) URL', () => {
    expect(extractFirstHttpUrl('')).toBeNull();
    expect(extractFirstHttpUrl('Hello there, no links here')).toBeNull();
    expect(extractFirstHttpUrl('ftp://example.com/file')).toBeNull();
    expect(extractFirstHttpUrl('example.com/without-a-scheme')).toBeNull();
  });

  it.each([
    ['https://example.com', 'https://example.com'],
    ['look at https://example.com/a?b=1#c now', 'https://example.com/a?b=1#c'],
    ['HTTPS://EXAMPLE.COM/Path', 'HTTPS://EXAMPLE.COM/Path'],
    ['http://example.com/plain', 'http://example.com/plain'],
  ])('extracts %j', (text, expected) => {
    expect(extractFirstHttpUrl(text)).toBe(expected);
  });

  it('returns only the first URL in a message', () => {
    expect(
      extractFirstHttpUrl(
        'one https://first.example/a two https://second.test',
      ),
    ).toBe('https://first.example/a');
  });

  it.each([
    ['Check https://example.com/page.', 'https://example.com/page'],
    ['Have you seen https://example.com/page?', 'https://example.com/page'],
    ['Wow https://example.com/page!!!', 'https://example.com/page'],
    [
      'Links: https://example.com/a, https://example.com/b',
      'https://example.com/a',
    ],
    ['Read this: https://example.com/page;', 'https://example.com/page'],
    ["He said 'https://example.com/page'", 'https://example.com/page'],
    ['**https://example.com/page**', 'https://example.com/page'],
    ['Wait... https://example.com/page...', 'https://example.com/page'],
  ])('strips trailing sentence punctuation from %j', (text, expected) => {
    expect(extractFirstHttpUrl(text)).toBe(expected);
  });

  it('keeps meaningful query punctuation inside the URL', () => {
    expect(extractFirstHttpUrl('https://example.com/search?q=a.b,c;d')).toBe(
      'https://example.com/search?q=a.b,c;d',
    );
  });

  it.each([
    ['(see https://example.com/page)', 'https://example.com/page'],
    ['(see https://example.com/page).', 'https://example.com/page'],
    ['[docs](https://example.com/page)', 'https://example.com/page'],
    ['{https://example.com/page}', 'https://example.com/page'],
    ['<https://example.com/page>', 'https://example.com/page'],
    ['"https://example.com/page"', 'https://example.com/page'],
    ['`https://example.com/page`', 'https://example.com/page'],
  ])('drops surrounding delimiters in %j', (text, expected) => {
    expect(extractFirstHttpUrl(text)).toBe(expected);
  });

  it('keeps brackets that the URL itself opened', () => {
    expect(
      extractFirstHttpUrl('https://en.wikipedia.org/wiki/Rust_(language)'),
    ).toBe('https://en.wikipedia.org/wiki/Rust_(language)');
    expect(
      extractFirstHttpUrl(
        '(see https://en.wikipedia.org/wiki/Rust_(language))',
      ),
    ).toBe('https://en.wikipedia.org/wiki/Rust_(language)');
    expect(
      extractFirstHttpUrl(
        'Read https://en.wikipedia.org/wiki/Rust_(language).',
      ),
    ).toBe('https://en.wikipedia.org/wiki/Rust_(language)');
    expect(extractFirstHttpUrl('https://example.com/a[0]')).toBe(
      'https://example.com/a[0]',
    );
  });

  it.each([
    ['請看https://example.com/post。謝謝', 'https://example.com/post'],
    ['https://example.com/post、そして', 'https://example.com/post'],
    ['（https://example.com/post）', 'https://example.com/post'],
    ['「https://example.com/post」', 'https://example.com/post'],
    ['https://example.com/post，然后', 'https://example.com/post'],
    ['https://example.com/post！', 'https://example.com/post'],
    ['زوروا https://example.com/post، شكراً', 'https://example.com/post'],
    ['هل رأيت https://example.com/post؟', 'https://example.com/post'],
    ['https://example.com/post। अगला', 'https://example.com/post'],
    ['« https://example.com/post »', 'https://example.com/post'],
    ['“https://example.com/post”', 'https://example.com/post'],
    ['https://example.com/post…', 'https://example.com/post'],
  ])('ends the URL at non-ASCII punctuation in %j', (text, expected) => {
    expect(extractFirstHttpUrl(text)).toBe(expected);
  });

  it('keeps internationalised paths that are part of the URL', () => {
    expect(extractFirstHttpUrl('https://zh.wikipedia.org/wiki/中文 好的')).toBe(
      'https://zh.wikipedia.org/wiki/中文',
    );
    expect(extractFirstHttpUrl('https://例え.jp/パス')).toBe(
      'https://例え.jp/パス',
    );
  });

  it('skips unusable candidates and returns the next well-formed URL', () => {
    // `http://[` is an unterminated IPv6 literal, so it is not a parseable URL.
    expect(
      extractFirstHttpUrl('broken http://[ then https://ok.example/a'),
    ).toBe('https://ok.example/a');
  });

  it('gives up after a bounded number of unusable candidates', () => {
    const noise = Array.from({ length: 50 }, () => 'http://[').join(' ');

    expect(extractFirstHttpUrl(`${noise} https://late.example`)).toBeNull();
  });

  it('does not treat a bare scheme as a URL', () => {
    expect(extractFirstHttpUrl('https://')).toBeNull();
    expect(extractFirstHttpUrl('see http:// for details')).toBeNull();
  });

  it('handles very long input in linear time', () => {
    const text = `${'a '.repeat(200_000)}https://example.com/end`;
    const started = Date.now();

    expect(extractFirstHttpUrl(text)).toBe('https://example.com/end');
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
