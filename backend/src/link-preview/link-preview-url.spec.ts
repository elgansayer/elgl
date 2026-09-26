import {
  assertPublicHttpUrl,
  canonicalLinkPreviewUrl,
  extractFirstHttpUrl,
  MAX_LINK_PREVIEW_URL_LENGTH,
  parseLinkPreviewUrl,
  UnsafeLinkPreviewUrlError,
} from './link-preview-url';

function reasonFor(action: () => unknown): string | undefined {
  try {
    action();
  } catch (error) {
    return error instanceof UnsafeLinkPreviewUrlError
      ? error.reason
      : `unexpected:${String(error)}`;
  }
  return undefined;
}

describe('parseLinkPreviewUrl', () => {
  it('returns a normalised URL for an ordinary public page', () => {
    const parsed = parseLinkPreviewUrl('https://Example.com/Path?q=1#frag');

    expect(parsed).toBeInstanceOf(URL);
    expect(parsed.href).toBe('https://example.com/Path?q=1#frag');
  });

  it('accepts explicit default ports and public IP literals', () => {
    expect(parseLinkPreviewUrl('https://example.com:443/').href).toBe(
      'https://example.com/',
    );
    expect(parseLinkPreviewUrl('http://example.com:80/').href).toBe(
      'http://example.com/',
    );
    expect(parseLinkPreviewUrl('http://8.8.8.8/').hostname).toBe('8.8.8.8');
    expect(
      parseLinkPreviewUrl('https://[2606:4700:4700::1111]/').hostname,
    ).toBe('[2606:4700:4700::1111]');
  });

  it('rejects URLs beyond the length bound', () => {
    const url = `https://example.com/${'a'.repeat(MAX_LINK_PREVIEW_URL_LENGTH)}`;

    expect(reasonFor(() => parseLinkPreviewUrl(url))).toBe('too_long');
  });

  it.each(['not a url', '', '//example.com', 'example.com/page'])(
    'rejects malformed input %j',
    (raw) => {
      expect(reasonFor(() => parseLinkPreviewUrl(raw))).toBe('malformed');
    },
  );

  it.each([
    'ftp://example.com/file',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'data:text/html,hello',
    'gopher://example.com/',
  ])('rejects the non-http(s) URL %s', (raw) => {
    expect(reasonFor(() => parseLinkPreviewUrl(raw))).toBe('protocol');
  });

  it.each([
    'https://user:pass@example.com/',
    'https://user@example.com/',
    'https://:pass@example.com/',
  ])('rejects embedded credentials in %s', (raw) => {
    expect(reasonFor(() => parseLinkPreviewUrl(raw))).toBe('credentials');
  });

  it.each([
    'https://example.com:8443/',
    'http://example.com:8080/',
    'https://example.com:80/',
    'http://example.com:443/',
    'http://example.com:6379/',
  ])('rejects the custom port in %s', (raw) => {
    expect(reasonFor(() => parseLinkPreviewUrl(raw))).toBe('port');
  });

  it.each([
    'http://localhost/',
    'http://LOCALHOST/',
    'http://localhost./',
    'http://app.localhost/',
    'http://127.0.0.1/',
    'http://127.1/',
    'http://2130706433/',
    'http://0x7f.0.0.1/',
    'http://0177.0.0.1/',
    'http://10.0.0.5/',
    'http://172.16.0.1/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://0.0.0.0/',
    'http://100.64.0.1/',
    'http://[::1]/',
    'http://[::ffff:7f00:1]/',
    'http://[::ffff:169.254.169.254]/',
    'http://[fd00::1]/',
    'http://[fe80::1]/',
    'http://[64:ff9b::7f00:1]/',
    'http://[2002:7f00:1::1]/',
  ])('rejects the private literal host in %s', (raw) => {
    expect(reasonFor(() => parseLinkPreviewUrl(raw))).toBe('private_host');
  });

  it.each([
    'http://intranet/',
    'http://backend/',
    'http://db.internal/',
    'http://metadata.google.internal/computeMetadata/v1/',
    'http://printer.local/',
    'http://nas.lan/',
    'http://router.home.arpa/',
    'http://wiki.corp/',
    'http://wiki.intranet/',
    'http://host.localdomain/',
  ])('rejects the non-public hostname in %s', (raw) => {
    expect(reasonFor(() => parseLinkPreviewUrl(raw))).toBe('private_host');
  });

  it('does not treat public names that merely contain a reserved word as private', () => {
    expect(() =>
      parseLinkPreviewUrl('https://locally.example.com/'),
    ).not.toThrow();
    expect(() =>
      parseLinkPreviewUrl('https://internal.example.com/'),
    ).not.toThrow();
    expect(() =>
      parseLinkPreviewUrl('https://corporate.example/'),
    ).not.toThrow();
  });

  it('uses the stable public error messages', () => {
    expect(() => parseLinkPreviewUrl('not a url')).toThrow('Malformed URL');
    expect(() => parseLinkPreviewUrl('ftp://example.com')).toThrow(
      'Only http and https protocols are allowed',
    );
    expect(() => parseLinkPreviewUrl('https://u:p@example.com')).toThrow(
      'Embedded credentials are not allowed',
    );
    expect(() => parseLinkPreviewUrl('https://example.com:81')).toThrow(
      'Custom ports are not allowed',
    );
    expect(() => parseLinkPreviewUrl('http://127.0.0.1')).toThrow(
      'Private network URLs are not allowed',
    );
  });
});

describe('assertPublicHttpUrl', () => {
  it('validates URLs that were parsed elsewhere, such as redirect targets', () => {
    expect(() =>
      assertPublicHttpUrl(new URL('https://cdn.example.com/a.png')),
    ).not.toThrow();
    expect(
      reasonFor(() => assertPublicHttpUrl(new URL('http://127.0.0.1:6379/'))),
    ).toBe('port');
    expect(
      reasonFor(() => assertPublicHttpUrl(new URL('http://169.254.169.254/'))),
    ).toBe('private_host');
  });
});

describe('canonicalLinkPreviewUrl', () => {
  it('normalises the URL the same way the scraper does', () => {
    expect(canonicalLinkPreviewUrl('https://Example.com')).toBe(
      'https://example.com/',
    );
  });

  it('returns null for text that is not a URL', () => {
    expect(canonicalLinkPreviewUrl('not a url')).toBeNull();
  });
});

describe('extractFirstHttpUrl', () => {
  it.each([
    ['Look at https://example.com/a now', 'https://example.com/a'],
    ['https://example.com', 'https://example.com'],
    ['HTTPS://EXAMPLE.COM/Path', 'HTTPS://EXAMPLE.COM/Path'],
    [
      'first http://a.example.com then https://b.example.com',
      'http://a.example.com',
    ],
    [
      'line one\nhttps://example.com/two\nline three',
      'https://example.com/two',
    ],
    ['https://example.com/a?x=1&y=2#top', 'https://example.com/a?x=1&y=2#top'],
  ])('finds the link in %j', (text, expected) => {
    expect(extractFirstHttpUrl(text)).toBe(expected);
  });

  it.each([
    ['See https://example.com/a.', 'https://example.com/a'],
    ['See https://example.com/a, then', 'https://example.com/a'],
    ['Is it https://example.com/a?', 'https://example.com/a'],
    ['Wow https://example.com/a!!!', 'https://example.com/a'],
    ['(https://example.com/a)', 'https://example.com/a'],
    ['[https://example.com/a]', 'https://example.com/a'],
    ['"https://example.com/a"', 'https://example.com/a'],
    ['<https://example.com/a>', 'https://example.com/a'],
    ["'https://example.com/a'", 'https://example.com/a'],
    ['https://example.com/a).', 'https://example.com/a'],
  ])('drops sentence punctuation around %j', (text, expected) => {
    expect(extractFirstHttpUrl(text)).toBe(expected);
  });

  it('keeps balanced brackets that belong to the address', () => {
    expect(
      extractFirstHttpUrl('See https://en.wikipedia.org/wiki/Foo_(bar).'),
    ).toBe('https://en.wikipedia.org/wiki/Foo_(bar)');
    expect(
      extractFirstHttpUrl('(see https://en.wikipedia.org/wiki/Foo_(bar))'),
    ).toBe('https://en.wikipedia.org/wiki/Foo_(bar)');
  });

  it.each([
    ['これを見て https://example.com/ja。', 'https://example.com/ja'],
    ['https://example.com/zh，然后', 'https://example.com/zh'],
    ['（https://example.com/ja）です', 'https://example.com/ja'],
    ['「https://example.com/ja」', 'https://example.com/ja'],
    ['https://example.com/ko！', 'https://example.com/ko'],
    ['https://example.com/a\u{3000}next', 'https://example.com/a'],
  ])('stops at CJK and full-width punctuation in %j', (text, expected) => {
    expect(extractFirstHttpUrl(text)).toBe(expected);
  });

  it('keeps non-Latin path characters that are not punctuation', () => {
    expect(extractFirstHttpUrl('https://example.com/日本語/ページ')).toBe(
      'https://example.com/日本語/ページ',
    );
  });

  it.each([
    'no link here',
    '',
    'ftp://example.com/file',
    'https://',
    'see https://.',
    'example.com without a scheme',
  ])('returns null when %j has no usable http(s) link', (text) => {
    expect(extractFirstHttpUrl(text)).toBeNull();
  });

  it('extracts the first link even when it is not yet accepted by the scraper policy', () => {
    const extracted = extractFirstHttpUrl('try http://127.0.0.1/admin please');

    expect(extracted).toBe('http://127.0.0.1/admin');
    expect(reasonFor(() => parseLinkPreviewUrl(extracted ?? ''))).toBe(
      'private_host',
    );
  });
});

describe('extractFirstHttpUrl on adversarial input', () => {
  // Messages may be 10,000 characters and this runs synchronously on every
  // send, so trimming must stay linear: a quadratic version needs seconds for
  // the sizes below, which would block the event loop for every other user.
  const SIZE = 30_000;

  it.each([
    [
      'a long run of sentence punctuation',
      `https://a${'.'.repeat(SIZE)}b`,
      `https://a${'.'.repeat(SIZE)}b`,
    ],
    [
      'a long run of trailing sentence punctuation',
      `https://a${'.'.repeat(SIZE)}`,
      'https://a',
    ],
    [
      'a long run of closing brackets',
      `https://a${')'.repeat(SIZE)}`,
      'https://a',
    ],
    [
      'alternating punctuation and closing brackets',
      `https://a${'.)'.repeat(SIZE / 2)}`,
      'https://a',
    ],
    [
      'balanced brackets followed by extra closers',
      `https://a/${'('.repeat(SIZE / 2)}${')'.repeat(SIZE)}`,
      `https://a/${'('.repeat(SIZE / 2)}${')'.repeat(SIZE / 2)}`,
    ],
  ])('stays linear for %s', (_label, text, expected) => {
    const started = Date.now();

    const extracted = extractFirstHttpUrl(text);

    expect(Date.now() - started).toBeLessThan(1_000);
    expect(extracted).toBe(expected);
  });

  it.each([
    ['thousands of link openers', 'https://'.repeat(SIZE / 8)],
    ['a very long token without a scheme', 'x'.repeat(SIZE * 4)],
    ['a very long run of whitespace', ' '.repeat(SIZE * 4)],
    ['many short links', 'a https://b '.repeat(SIZE / 4)],
  ])('stays linear for %s', (_label, text) => {
    const started = Date.now();

    extractFirstHttpUrl(text);

    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
