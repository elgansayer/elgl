import {
  addBusinessDays,
  daysBefore,
  generateNoticeReference,
  generateVerificationToken,
  hashVerificationToken,
  hoursAfter,
  keyFromPublicUrl,
  monthsBefore,
  normaliseClaimantEmail,
  parseMaterialReference,
} from './dmca-policy';

const PUBLIC_BASE = 'https://cdn.example.com';
const OWNER = '3f2b8c1e-7a4d-4e5f-9b6a-1c2d3e4f5a6b';

describe('dmca policy', () => {
  describe('addBusinessDays', () => {
    it('counts ten business days from a Wednesday as two calendar weeks', () => {
      const wednesday = new Date('2026-11-11T09:30:00.000Z');
      expect(addBusinessDays(wednesday, 10).toISOString()).toBe(
        '2026-11-25T09:30:00.000Z',
      );
    });

    it('skips weekends when the start is a Friday', () => {
      const friday = new Date('2026-11-13T12:00:00.000Z');
      expect(addBusinessDays(friday, 1).toISOString()).toBe(
        '2026-11-16T12:00:00.000Z',
      );
      expect(addBusinessDays(friday, 5).toISOString()).toBe(
        '2026-11-20T12:00:00.000Z',
      );
    });

    it('starts counting on the next business day when the notice arrives on a weekend', () => {
      const saturday = new Date('2026-11-14T12:00:00.000Z');
      expect(addBusinessDays(saturday, 1).toISOString()).toBe(
        '2026-11-16T12:00:00.000Z',
      );
    });

    it('never lands on a weekend and never mutates its input', () => {
      const start = new Date('2026-11-11T00:00:00.000Z');
      for (let days = 1; days <= 30; days += 1) {
        const result = addBusinessDays(start, days);
        expect([0, 6]).not.toContain(result.getUTCDay());
      }
      expect(start.toISOString()).toBe('2026-11-11T00:00:00.000Z');
    });

    it('stays inside the statutory 10 to 14 business day window in calendar terms', () => {
      const start = new Date('2026-11-11T00:00:00.000Z');
      const days =
        (addBusinessDays(start, 10).getTime() - start.getTime()) / 86_400_000;
      expect(days).toBeGreaterThanOrEqual(14);
      expect(days).toBeLessThanOrEqual(18);
    });
  });

  describe('references and tokens', () => {
    it('generates public references that match the database constraint', () => {
      for (let i = 0; i < 50; i += 1) {
        expect(generateNoticeReference()).toMatch(/^DMCA-[0-9A-Z]{10}$/);
      }
    });

    it('is deterministic for a given random source', () => {
      const fixed = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(generateNoticeReference(() => fixed)).toBe('DMCA-0123456789');
    });

    it('issues unguessable url-safe tokens and stores only their sha-256', () => {
      const first = generateVerificationToken();
      const second = generateVerificationToken();

      expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(first.token).not.toBe(second.token);
      expect(first.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(first.hash).toBe(hashVerificationToken(first.token));
      expect(first.hash).not.toContain(first.token);
    });

    it('normalises claimant mailboxes for per-claimant limits', () => {
      expect(normaliseClaimantEmail('  Claimant@Example.COM ')).toBe(
        'claimant@example.com',
      );
    });
  });

  describe('keyFromPublicUrl', () => {
    it('returns the object key for a file on the public media origin', () => {
      expect(
        keyFromPublicUrl(
          `${PUBLIC_BASE}/moments/${OWNER}/1-abc.jpg`,
          PUBLIC_BASE,
        ),
      ).toBe(`moments/${OWNER}/1-abc.jpg`);
    });

    it('respects a path prefix on the public base and decodes segments', () => {
      expect(
        keyFromPublicUrl(
          'https://media.example.com/files/moments/a%20b/c.png',
          'https://media.example.com/files/',
        ),
      ).toBe('moments/a b/c.png');
    });

    it.each([
      'https://evil.example.com/moments/x/y.jpg',
      'http://cdn.example.com/moments/x/y.jpg',
      'https://cdn.example.com.evil.com/moments/x/y.jpg',
      'https://cdn.example.com/moments/%2Fsecret',
      'https://cdn.example.com/moments/a%00b',
      'https://cdn.example.com/moments/a%5Cb',
      'https://cdn.example.com/moments//double',
      'https://cdn.example.com/',
      'https://cdn.example.com/moments/x/y.jpg?token=1',
      'https://cdn.example.com/moments/x/y.jpg#frag',
      'not a url',
      'https://cdn.example.com/%E0%A4%A',
    ])('rejects %j', (value) => {
      expect(keyFromPublicUrl(value, PUBLIC_BASE)).toBeNull();
    });

    it('resolves dot segments the way the origin does, so traversal cannot leave a base path prefix', () => {
      const base = 'https://media.example.com/files/';
      expect(
        keyFromPublicUrl(
          'https://media.example.com/files/../private/x.jpg',
          base,
        ),
      ).toBeNull();
      expect(
        keyFromPublicUrl(
          'https://media.example.com/files/%2e%2e/private/x.jpg',
          base,
        ),
      ).toBeNull();
      // Without a prefix the normalised address is simply another key.
      expect(
        keyFromPublicUrl(
          'https://cdn.example.com/moments/../secret',
          PUBLIC_BASE,
        ),
      ).toBe('secret');
    });

    it('rejects keys longer than the storage limit', () => {
      expect(
        keyFromPublicUrl(`${PUBLIC_BASE}/${'a'.repeat(1100)}`, PUBLIC_BASE),
      ).toBeNull();
    });

    it('returns null when the configured base is not a url', () => {
      expect(keyFromPublicUrl(`${PUBLIC_BASE}/a/b`, 'not-a-base')).toBeNull();
    });
  });

  describe('parseMaterialReference', () => {
    const MOMENT = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

    it('accepts a bare content identifier in any case', () => {
      expect(parseMaterialReference(MOMENT.toUpperCase(), PUBLIC_BASE)).toEqual(
        {
          kind: 'id',
          id: MOMENT,
        },
      );
    });

    it('finds the identifier inside a pasted link', () => {
      expect(
        parseMaterialReference(
          `https://app.example.com/moments/${MOMENT}?ref=x`,
          PUBLIC_BASE,
        ),
      ).toEqual({ kind: 'id', id: MOMENT });
    });

    it('reads the owner from an uploaded file URL', () => {
      const url = `${PUBLIC_BASE}/moments/${OWNER}/1700000000-ab12.jpg`;
      expect(parseMaterialReference(url, PUBLIC_BASE)).toEqual({
        kind: 'media',
        url,
        ownerId: OWNER,
      });
    });

    it('does not guess an owner when the key has no account segment', () => {
      expect(
        parseMaterialReference(
          `${PUBLIC_BASE}/stickers/pack-one.png`,
          PUBLIC_BASE,
        ),
      ).toEqual({ kind: 'unknown' });
    });

    it('does not treat a longer segment that merely contains an id as an owner', () => {
      expect(
        parseMaterialReference(
          `${PUBLIC_BASE}/moments/prefix-${OWNER}/x.jpg`,
          PUBLIC_BASE,
        ),
      ).toEqual({ kind: 'unknown' });
    });

    it.each(['', '   ', 'a photo of my dog', 'x'.repeat(3000)])(
      'cannot identify %j',
      (value) => {
        expect(parseMaterialReference(value, PUBLIC_BASE)).toEqual({
          kind: 'unknown',
        });
      },
    );
  });

  describe('date helpers', () => {
    const now = new Date('2026-11-11T10:00:00.000Z');

    it('moves instants by months, days and hours', () => {
      expect(monthsBefore(now, 12).toISOString()).toBe(
        '2025-11-11T10:00:00.000Z',
      );
      expect(daysBefore(now, 30).toISOString()).toBe(
        '2026-10-12T10:00:00.000Z',
      );
      expect(hoursAfter(now, 72).toISOString()).toBe(
        '2026-11-14T10:00:00.000Z',
      );
    });
  });
});
