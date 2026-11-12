import { inspect } from 'node:util';
import {
  PII_CATEGORIES,
  PiiCategory,
  PiiMetrics,
  PiiTelemetry,
  ProtectedText,
  describePiiSummary,
  protectForProvider,
  protectText,
  restoreFromProvider,
} from './pii-redaction';

const PLACEHOLDER = /PII[A-Z]{8}\d+Z/g;

function placeholdersOf(text: string): string[] {
  return text.match(PLACEHOLDER) ?? [];
}

describe('protectText', () => {
  describe('text without sensitive data', () => {
    it('is returned unchanged and reported as clean', () => {
      const protectedText = protectText('Hello, how are you today?');

      expect(protectedText.text).toBe('Hello, how are you today?');
      expect(protectedText.outcome).toBe('clean');
      expect(protectedText.summary).toEqual({ total: 0, byCategory: {} });
      expect(protectedText.nothingToTranslate).toBe(false);
      expect(protectedText.segments).toEqual(['Hello, how are you today?']);
    });

    it('restores to exactly the same text', () => {
      const protectedText = protectText('Bonjour tout le monde');

      expect(protectedText.restore('Hello everyone')).toBe('Hello everyone');
    });

    it.each([
      ['small counts', 'I have 3 cats and 12 dogs'],
      ['a clock time and an ISO date', 'Meet at 10:30 on 2026-11-11'],
      ['an ISO date with an hour', 'Booked for 2026-11-11 10'],
      ['a day-first date', 'Born on 11.11.2026'],
      ['a software version', 'Upgrade to version 1.2.3'],
      ['a decimal price', 'It costs 1,299.99 pounds'],
      ['a long decimal', 'Pi is 3.14159265358979'],
      ['a year range', 'The 2020-2021 season'],
      ['a year range with an en dash', 'The 2020\u20132021 season'],
      ['a short number', 'Call 999 now'],
      ['a room number', 'Room 4012 is free'],
      ['a plain at sign', 'Meet me @ 5pm'],
      ['code scope syntax', 'Use std::vector here'],
      ['empty text', ''],
      ['whitespace', '   '],
    ])('does not mask %s', (_label, input) => {
      const protectedText = protectText(input);

      expect(protectedText.text).toBe(input);
      expect(protectedText.outcome).toBe('clean');
    });
  });

  describe('detection', () => {
    const cases: ReadonlyArray<[string, string, string, PiiCategory]> = [
      [
        'an email address',
        'Write to john.doe+chat@example.com please',
        'john.doe+chat@example.com',
        'email',
      ],
      [
        'an email with a plus tag and subdomain',
        'mail:a_b-c@mail.example.co.uk.',
        'a_b-c@mail.example.co.uk',
        'email',
      ],
      [
        'a fullwidth email typed on a CJK keyboard',
        'メールはｊｏｈｎ＠ｅｘａｍｐｌｅ．ｃｏｍです',
        'ｊｏｈｎ＠ｅｘａｍｐｌｅ．ｃｏｍ',
        'email',
      ],
      [
        'an https URL',
        'Look at https://example.com/profile?id=42&token=abc now',
        'https://example.com/profile?id=42&token=abc',
        'url',
      ],
      [
        'a www URL',
        'Visit www.example.org/page',
        'www.example.org/page',
        'url',
      ],
      [
        'a social profile link without a scheme',
        'Add me on instagram.com/john_doe',
        'instagram.com/john_doe',
        'url',
      ],
      ['a social handle', 'Follow @john_doe.', '@john_doe', 'handle'],
      [
        'a Latin IBAN with spaces',
        'My IBAN is GB82 WEST 1234 5698 7654 32 thanks',
        'GB82 WEST 1234 5698 7654 32',
        'iban',
      ],
      [
        'a compact IBAN',
        'IBAN: DE89370400440532013000',
        'DE89370400440532013000',
        'iban',
      ],
      [
        'a US social security number',
        'My SSN is 123-45-6789',
        '123-45-6789',
        'national_id',
      ],
      [
        'a UK national insurance number',
        'NI number AB 12 34 56 C ok',
        'AB 12 34 56 C',
        'national_id',
      ],
      ['an IPv4 address', 'Server is 203.0.113.5 today', '203.0.113.5', 'ip'],
      [
        'an IPv6 address',
        'Server is 2001:db8::8a2e:370:7334 today',
        '2001:db8::8a2e:370:7334',
        'ip',
      ],
      ['the IPv6 loopback', 'Listening on ::1', '::1', 'ip'],
      [
        'a spaced payment card',
        'Card 4111 1111 1111 1111 exp 12/29',
        '4111 1111 1111 1111',
        'card',
      ],
      [
        'a compact payment card',
        'Card 5555555555554444 exp 12/29',
        '5555555555554444',
        'card',
      ],
      [
        'a hyphenated Amex-style card',
        'Card 3782-822463-10005 ok',
        '3782-822463-10005',
        'card',
      ],
      [
        'an international phone number',
        'Call +44 7700 900123 tonight',
        '+44 7700 900123',
        'phone',
      ],
      [
        'a bracketed national phone number',
        'Call (555) 123-4567 tonight',
        '(555) 123-4567',
        'phone',
      ],
      [
        'a UK mobile number',
        'Text 07700 900123 tonight',
        '07700 900123',
        'phone',
      ],
      [
        'a compact mobile number',
        'Text 07700900123 tonight',
        '07700900123',
        'phone',
      ],
      [
        'a phone number in Arabic-Indic digits',
        'رقمي ٠٧٧٠٠٩٠٠١٢٣ شكرا',
        '٠٧٧٠٠٩٠٠١٢٣',
        'phone',
      ],
      [
        'a phone number in fullwidth digits',
        '電話は０７７００９００１２３です',
        '０７７００９００１２３',
        'phone',
      ],
      [
        'a phone number glued to CJK text',
        '電話番号は07700900123です',
        '07700900123',
        'phone',
      ],
      [
        'a phone number grouped with non-breaking spaces',
        'Appelle le 07\u00A070\u00A009\u00A000\u00A012 ce soir',
        '07\u00A070\u00A009\u00A000\u00A012',
        'phone',
      ],
      [
        'a phone number joined by en dashes',
        'Call 555\u2013123\u20134567 tonight',
        '555\u2013123\u20134567',
        'phone',
      ],
      [
        'a phone number grouped with ideographic spaces',
        '電話は090\u30001234\u30005678です',
        '090\u30001234\u30005678',
        'phone',
      ],
      [
        'an IBAN grouped with non-breaking spaces',
        'IBAN GB82\u00A0WEST\u00A01234\u00A05698\u00A07654\u00A032 ok',
        'GB82\u00A0WEST\u00A01234\u00A05698\u00A07654\u00A032',
        'iban',
      ],
    ];

    it.each(cases)(
      'masks %s and restores it exactly',
      (_label, input, sensitive, category) => {
        const protectedText = protectText(input);

        expect(protectedText.text).not.toContain(sensitive);
        expect(placeholdersOf(protectedText.text)).toHaveLength(1);
        expect(protectedText.summary).toEqual({
          total: 1,
          byCategory: { [category]: 1 },
        });
        expect(protectedText.restore(protectedText.text)).toBe(input);
      },
    );

    it('masks every category in one message and keeps the surrounding words', () => {
      const input =
        'Hi, mail john@example.com, call +44 7700 900123, card 4111 1111 1111 1111, see https://example.com/me from 203.0.113.5';
      const protectedText = protectText(input);

      for (const sensitive of [
        'john@example.com',
        '+44 7700 900123',
        '4111 1111 1111 1111',
        'https://example.com/me',
        '203.0.113.5',
      ]) {
        expect(protectedText.text).not.toContain(sensitive);
      }
      expect(protectedText.text).toMatch(/^Hi, mail PII/);
      expect(protectedText.text).toContain(', call ');
      expect(protectedText.summary.byCategory).toEqual({
        email: 1,
        phone: 1,
        card: 1,
        url: 1,
        ip: 1,
      });
      expect(protectedText.restore(protectedText.text)).toBe(input);
    });

    it('numbers each occurrence of the same value separately', () => {
      const protectedText = protectText('a@example.com and a@example.com');

      expect(new Set(placeholdersOf(protectedText.text)).size).toBe(2);
      expect(protectedText.summary.total).toBe(2);
    });

    it('handles adjacent sensitive spans', () => {
      const input = 'a@example.com,b@example.com';
      const protectedText = protectText(input);

      expect(protectedText.summary.byCategory).toEqual({ email: 2 });
      expect(protectedText.restore(protectedText.text)).toBe(input);
    });

    it('keeps trailing punctuation outside a URL', () => {
      const protectedText = protectText('(see https://example.com/a/b).');

      expect(protectedText.text).toMatch(/^\(see PII[A-Z]{8}0Z\)\.$/);
    });

    it('lets the higher-priority span own overlapping candidates', () => {
      const protectedText = protectText(
        'Open https://203.0.113.5/user/07700900123?mail=a@example.com now',
      );

      expect(protectedText.summary.byCategory).toEqual({ url: 1 });
    });

    it('masks a card that is not part of a longer IBAN or phone match first', () => {
      const protectedText = protectText('4111111111111111');

      expect(protectedText.summary.byCategory).toEqual({ card: 1 });
    });

    it('still masks a long digit run that fails the card checksum', () => {
      const protectedText = protectText(
        'Card 4111 1111 1111 1112 expires soon',
      );

      expect(protectedText.text).not.toContain('4111');
      expect(protectedText.summary.byCategory).toEqual({ phone: 1 });
    });

    it('does not treat an IBAN with a bad checksum as an IBAN', () => {
      const protectedText = protectText('GB82 WEST 1234 5698 7654 33');

      expect(protectedText.summary.byCategory.iban).toBeUndefined();
      expect(protectedText.text).not.toContain('1234 5698 7654 33');
    });

    it('masks an IBAN without swallowing the words after it', () => {
      const protectedText = protectText(
        'ES91 2100 0418 4502 0005 1332 is the account',
      );

      expect(protectedText.text).toMatch(/^PII[A-Z]{8}0Z is the account$/);
      expect(protectedText.summary.byCategory).toEqual({ iban: 1 });
    });

    it('rejects impossible national identifiers as national identifiers', () => {
      for (const input of ['000-12-3456', '666-12-3456', '900-12-3456']) {
        const protectedText = protectText(input);
        expect(protectedText.summary.byCategory.national_id).toBeUndefined();
      }
      expect(protectText('BG 12 34 56 C').summary.total).toBe(0);
    });

    it('does not mask an IPv4-like value with an octet above 255', () => {
      expect(protectText('Code 999.1.1.1 is invalid').summary.total).toBe(0);
    });
  });

  describe('nothingToTranslate', () => {
    it('is true when only sensitive spans remain', () => {
      const protectedText = protectText('john@example.com');

      expect(protectedText.nothingToTranslate).toBe(true);
      expect(protectedText.outcome).toBe('skipped');
    });

    it('is true when only digits, punctuation and emoji surround the spans', () => {
      expect(protectText('📧 john@example.com 123!').nothingToTranslate).toBe(
        true,
      );
    });

    it('is false when translatable words remain', () => {
      const protectedText = protectText('Email me at john@example.com');

      expect(protectedText.nothingToTranslate).toBe(false);
      expect(protectedText.outcome).toBe('redacted');
    });

    it('is false for text with no sensitive data, even without letters', () => {
      expect(protectText('12345').nothingToTranslate).toBe(false);
    });
  });

  describe('placeholders', () => {
    it('are unguessable and differ on every call', () => {
      const first = protectText('mail john@example.com');
      const second = protectText('mail john@example.com');

      expect(placeholdersOf(first.text)).toHaveLength(1);
      expect(placeholdersOf(first.text)[0]).not.toBe(
        placeholdersOf(second.text)[0],
      );
    });

    it('contain only ASCII letters and digits so providers leave them alone', () => {
      const protectedText = protectText(
        'mail john@example.com or ana@example.org',
      );

      for (const placeholder of placeholdersOf(protectedText.text)) {
        expect(placeholder).toMatch(/^[A-Za-z0-9]+$/);
      }
    });

    it('never carry the sensitive value', () => {
      const input =
        'Pay GB82 WEST 1234 5698 7654 32, mail john.doe@example.com, call +44 7700 900123, SSN 123-45-6789, see https://example.com/secret?token=abc, card 4111 1111 1111 1111, ip 203.0.113.5, @john_doe';
      const protectedText = protectText(input);

      for (const sensitive of [
        'GB82',
        'john.doe',
        '7700',
        '123-45-6789',
        'secret',
        'token=abc',
        '4111',
        '203.0.113.5',
        'john_doe',
      ]) {
        expect(protectedText.text).not.toContain(sensitive);
      }
    });
  });

  describe('restore', () => {
    it('puts the original value back in translated text', () => {
      const protectedText = protectText('Contact me at john@example.com today');
      const [placeholder] = placeholdersOf(protectedText.text);

      expect(protectedText.restore(`Contáctame en ${placeholder} hoy`)).toBe(
        'Contáctame en john@example.com hoy',
      );
    });

    it('tolerates a provider changing the case of a placeholder', () => {
      const protectedText = protectText('Mail john@example.com');
      const [placeholder] = placeholdersOf(protectedText.text);

      expect(protectedText.restore(placeholder.toLowerCase())).toBe(
        'john@example.com',
      );
      expect(
        protectedText.restore(
          placeholder.charAt(0) + placeholder.slice(1).toLowerCase(),
        ),
      ).toBe('john@example.com');
    });

    it('tolerates a provider localising the digits of the index', () => {
      const protectedText = protectText('Mail john@example.com');
      const [placeholder] = placeholdersOf(protectedText.text);
      const localised = placeholder.replace('0Z', '٠Z');

      expect(protectedText.restore(localised)).toBe('john@example.com');
    });

    it('restores a placeholder the provider repeated', () => {
      const protectedText = protectText('Mail john@example.com');
      const [placeholder] = placeholdersOf(protectedText.text);

      expect(protectedText.restore(`${placeholder} / ${placeholder}`)).toBe(
        'john@example.com / john@example.com',
      );
    });

    it('restores several placeholders that the provider reordered', () => {
      const protectedText = protectText('a@example.com then b@example.com');
      const [first, second] = placeholdersOf(protectedText.text);

      expect(protectedText.restore(`${second} before ${first}`)).toBe(
        'b@example.com before a@example.com',
      );
    });

    it('inserts values literally, including replacement patterns', () => {
      const input = 'See https://example.com/?a=$&b=$1&c=$$ now';
      const protectedText = protectText(input);

      expect(protectedText.restore(protectedText.text)).toBe(input);
    });

    it('does not rescan restored values for placeholders', () => {
      const input = 'See https://example.com/?x=PIIAAAAAAAA0Z now';
      const protectedText = protectText(input);

      expect(protectedText.restore(protectedText.text)).toBe(input);
    });

    it('leaves a placeholder-looking string typed by the user alone', () => {
      const input = 'PIIAAAAAAAA0Z is literal, mail john@example.com';
      const protectedText = protectText(input);

      expect(protectedText.restore(protectedText.text)).toBe(input);
    });

    it('returns null when a placeholder was dropped', () => {
      const protectedText = protectText('Mail john@example.com');

      expect(protectedText.restore('Envía un correo')).toBeNull();
    });

    it('returns null when only some of several placeholders survive', () => {
      const protectedText = protectText('a@example.com and b@example.com');
      const [first] = placeholdersOf(protectedText.text);

      expect(protectedText.restore(`${first} y nada más`)).toBeNull();
    });

    it('returns null when the provider invented a placeholder index', () => {
      const protectedText = protectText('Mail john@example.com');
      const [placeholder] = placeholdersOf(protectedText.text);
      const invented = placeholder.replace('0Z', '7Z');

      expect(protectedText.restore(`${placeholder} ${invented}`)).toBeNull();
    });

    it('returns null when a placeholder was truncated or damaged', () => {
      const protectedText = protectText('Mail john@example.com');
      const [placeholder] = placeholdersOf(protectedText.text);

      expect(protectedText.restore(placeholder.slice(0, -1))).toBeNull();
      expect(protectedText.restore(placeholder.replace('Z', ' Z'))).toBeNull();
    });

    it('ignores placeholders that belong to a different call', () => {
      const protectedText = protectText('Mail john@example.com');
      const foreign = placeholdersOf(protectText('Mail ana@example.org').text);
      const [own] = placeholdersOf(protectedText.text);

      expect(protectedText.restore(`${own} ${foreign[0]}`)).toBe(
        `john@example.com ${foreign[0]}`,
      );
    });
  });

  describe('segments and rebuild', () => {
    it('exposes only the non-sensitive pieces that contain content', () => {
      const protectedText = protectText(
        'Hola john@example.com adiós ana@example.org',
      );

      expect(protectedText.segments).toEqual(['Hola ', ' adiós ']);
      for (const segment of protectedText.segments) {
        expect(segment).not.toContain('@');
      }
    });

    it('skips whitespace-only pieces between two sensitive spans', () => {
      const protectedText = protectText('a@example.com b@example.com');

      expect(protectedText.segments).toEqual([]);
    });

    it('rebuilds the text around the original values', () => {
      const protectedText = protectText('Hola john@example.com adiós');

      expect(protectedText.rebuild(['HOLA ', ' ADIÓS'])).toBe(
        'HOLA john@example.com ADIÓS',
      );
    });

    it('rebuilds text without sensitive data from its single segment', () => {
      const protectedText = protectText('Privet');

      expect(protectedText.rebuild(['Привет'])).toBe('Привет');
    });

    it('keeps whitespace-only pieces exactly as written', () => {
      const protectedText = protectText('a@example.com  b@example.com');

      expect(protectedText.rebuild([])).toBe('a@example.com  b@example.com');
    });

    it('returns null when the provider returned the wrong number of results', () => {
      const protectedText = protectText('Hola john@example.com adiós');

      expect(protectedText.rebuild(['HOLA '])).toBeNull();
      expect(protectedText.rebuild(['a', 'b', 'c'])).toBeNull();
    });
  });

  describe('disclosure of the original values', () => {
    const input = 'mail john.doe@example.com now';

    it('is impossible through JSON serialisation', () => {
      expect(JSON.stringify(protectText(input))).not.toContain('john.doe');
    });

    it('is impossible through util.inspect or string conversion', () => {
      const protectedText = protectText(input);

      expect(inspect(protectedText, { depth: 5 })).not.toContain('john.doe');
      expect(String(protectedText)).toBe('ProtectedText(redactions=1)');
    });

    it('keeps raw values out of the exposed summary and segments', () => {
      const protectedText = protectText(input);

      expect(JSON.stringify(protectedText.summary)).not.toContain('john.doe');
      expect(JSON.stringify(protectedText.segments)).not.toContain('john.doe');
    });
  });

  describe('worst-case input', () => {
    const size = 100_000;
    const adversarial: ReadonlyArray<[string, string]> = [
      ['a long run of local-part characters', 'a'.repeat(size)],
      ['a long run of at signs', '@'.repeat(size)],
      ['repeated local parts', 'a@'.repeat(size / 2)],
      ['hyphen-separated digits', '1-'.repeat(size / 2)],
      ['digits ending in a letter', `${'1 '.repeat(size / 2)}x`],
      ['an endless digit run ending in a letter', `${'1'.repeat(size)}a`],
      ['dotted labels', 'a.'.repeat(size / 2)],
      ['an endless domain', `a@${'b.'.repeat(size / 2)}`],
      ['an over-long local part', `${'a'.repeat(size)}@example.com`],
      ['colon runs', ':'.repeat(size)],
      ['hex groups', 'a:'.repeat(size / 2)],
      ['IBAN-looking prefixes', 'GB82 '.repeat(size / 5)],
      ['bracketed digits', '(1)'.repeat(size / 3)],
      ['scheme prefixes', 'https://'.repeat(size / 8)],
      ['many real emails', 'john@example.com '.repeat(size / 17)],
    ];

    it.each(adversarial)(
      'finishes quickly and round-trips for %s',
      (_label, input) => {
        const startedAt = performance.now();
        const protectedText = protectText(input);
        const restored = protectedText.restore(protectedText.text);

        expect(performance.now() - startedAt).toBeLessThan(2_000);
        expect(restored).toBe(input);
      },
    );
  });
});

describe('describePiiSummary', () => {
  it('lists category counts only', () => {
    const summary = protectText(
      'a@example.com b@example.com +44 7700 900123',
    ).summary;

    expect(describePiiSummary(summary)).toBe('email:2,phone:1');
  });

  it('is empty for a clean summary', () => {
    expect(describePiiSummary(protectText('hello').summary)).toBe('');
  });
});

describe('PII_CATEGORIES', () => {
  it('lists every category that detection can report', () => {
    const reported = new Set<string>();
    for (const input of [
      'https://example.com/a',
      'a@example.com',
      '@john_doe',
      'GB82 WEST 1234 5698 7654 32',
      '123-45-6789',
      '203.0.113.5',
      '4111 1111 1111 1111',
      '+44 7700 900123',
    ]) {
      for (const category of Object.keys(
        protectText(input).summary.byCategory,
      )) {
        reported.add(category);
      }
    }

    expect([...reported].sort()).toEqual([...PII_CATEGORIES].sort());
  });
});

describe('provider helpers', () => {
  let telemetry: PiiTelemetry & {
    debug: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let metrics: {
    recordPiiScrub: ReturnType<typeof vi.fn>;
    recordPiiRedactions: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    metrics = {
      recordPiiScrub: vi.fn(),
      recordPiiRedactions: vi.fn(),
    };
    telemetry = {
      debug: vi.fn(),
      warn: vi.fn(),
      metrics: metrics satisfies PiiMetrics,
    };
  });

  const context = { provider: 'deepl', operation: 'translate' } as const;

  describe('protectForProvider', () => {
    it('masks the text and records value-free diagnostics', () => {
      const protectedText = protectForProvider(
        'Mail john@example.com or +44 7700 900123',
        context,
        telemetry,
      );

      expect(protectedText).toBeInstanceOf(ProtectedText);
      expect(protectedText.text).not.toContain('john@example.com');
      expect(metrics.recordPiiScrub).toHaveBeenCalledWith(
        'deepl',
        'translate',
        'redacted',
      );
      expect(metrics.recordPiiRedactions).toHaveBeenCalledWith(
        'deepl',
        'translate',
        'email',
        1,
      );
      expect(metrics.recordPiiRedactions).toHaveBeenCalledWith(
        'deepl',
        'translate',
        'phone',
        1,
      );
      expect(telemetry.debug).toHaveBeenCalledWith(
        'pii_scrubbed provider=deepl operation=translate outcome=redacted redactions=2 categories=email:1,phone:1',
      );
      expect(JSON.stringify(telemetry.debug.mock.calls)).not.toContain(
        'john@example.com',
      );
    });

    it('records only the clean outcome and stays silent for clean text', () => {
      protectForProvider('Hello there', context, telemetry);

      expect(metrics.recordPiiScrub).toHaveBeenCalledWith(
        'deepl',
        'translate',
        'clean',
      );
      expect(metrics.recordPiiRedactions).not.toHaveBeenCalled();
      expect(telemetry.debug).not.toHaveBeenCalled();
    });

    it('records the skipped outcome when nothing translatable remains', () => {
      const protectedText = protectForProvider(
        'john@example.com',
        { provider: 'azure', operation: 'detect_language' },
        telemetry,
      );

      expect(protectedText.nothingToTranslate).toBe(true);
      expect(metrics.recordPiiScrub).toHaveBeenCalledWith(
        'azure',
        'detect_language',
        'skipped',
      );
    });

    it('works without a metrics sink', () => {
      const debug = vi.fn();
      const protectedText = protectForProvider(
        'Mail john@example.com',
        context,
        { debug, warn: vi.fn() },
      );

      expect(protectedText.summary.total).toBe(1);
      expect(debug).toHaveBeenCalledOnce();
    });
  });

  describe('restoreFromProvider', () => {
    it('returns the restored text without warning', () => {
      const protectedText = protectText('Mail john@example.com');
      const [placeholder] = placeholdersOf(protectedText.text);

      expect(
        restoreFromProvider(
          protectedText,
          `Correo ${placeholder}`,
          context,
          telemetry,
        ),
      ).toBe('Correo john@example.com');
      expect(telemetry.warn).not.toHaveBeenCalled();
      expect(metrics.recordPiiScrub).not.toHaveBeenCalled();
    });

    it('reports a mismatch without leaking the values', () => {
      const protectedText = protectText('Mail john@example.com');

      expect(
        restoreFromProvider(protectedText, 'Correo', context, telemetry),
      ).toBeNull();
      expect(telemetry.warn).toHaveBeenCalledWith(
        'pii_placeholder_mismatch provider=deepl operation=translate redactions=1',
      );
      expect(metrics.recordPiiScrub).toHaveBeenCalledWith(
        'deepl',
        'translate',
        'placeholder_mismatch',
      );
    });

    it('works without a metrics sink', () => {
      const warn = vi.fn();
      const protectedText = protectText('Mail john@example.com');

      expect(
        restoreFromProvider(protectedText, 'Correo', context, {
          debug: vi.fn(),
          warn,
        }),
      ).toBeNull();
      expect(warn).toHaveBeenCalledOnce();
    });
  });
});
