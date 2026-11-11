import {
  assessDateOfBirth,
  calculateAge,
  hashLockoutIdentifier,
  normaliseEmailForLockout,
  parseCalendarDate,
  toUtcCalendarDate,
} from './age-gate-policy';

describe('age-gate policy', () => {
  describe('parseCalendarDate', () => {
    it('parses a strict ISO calendar date', () => {
      expect(parseCalendarDate('2004-02-29')).toEqual({
        year: 2004,
        month: 2,
        day: 29,
      });
    });

    it.each([
      '',
      '2004-2-9',
      '04-02-2004',
      '2004/02/09',
      '2004-02-09T00:00:00Z',
      ' 2004-02-09',
      '2004-13-01',
      '2004-00-10',
      '2003-02-29',
      '2011-02-30',
      '2011-04-31',
    ])('rejects %j', (value) => {
      expect(parseCalendarDate(value)).toBeNull();
    });
  });

  describe('calculateAge', () => {
    const today = { year: 2026, month: 11, day: 11 };

    it('counts completed years only', () => {
      expect(calculateAge({ year: 2013, month: 11, day: 11 }, today)).toBe(13);
      expect(calculateAge({ year: 2013, month: 11, day: 12 }, today)).toBe(12);
      expect(calculateAge({ year: 2013, month: 12, day: 31 }, today)).toBe(12);
      expect(calculateAge({ year: 2013, month: 1, day: 1 }, today)).toBe(13);
    });
  });

  describe('assessDateOfBirth', () => {
    const now = new Date('2026-11-11T09:30:00.000Z');

    it('allows a user whose 13th birthday is today', () => {
      expect(assessDateOfBirth('2013-11-11', now)).toEqual({
        kind: 'eligible',
        age: 13,
      });
    });

    it('blocks a user who turns 13 tomorrow', () => {
      expect(assessDateOfBirth('2013-11-12', now)).toEqual({
        kind: 'under_age',
      });
    });

    it('blocks children and infants', () => {
      expect(assessDateOfBirth('2020-06-01', now)).toEqual({
        kind: 'under_age',
      });
      expect(assessDateOfBirth('2026-11-11', now)).toEqual({
        kind: 'under_age',
      });
    });

    it('allows adults', () => {
      expect(assessDateOfBirth('1990-05-17', now)).toEqual({
        kind: 'eligible',
        age: 36,
      });
    });

    it('rejects dates in the future as a typing mistake, not an age', () => {
      expect(assessDateOfBirth('2026-11-12', now)).toEqual({ kind: 'future' });
      expect(assessDateOfBirth('2999-01-01', now)).toEqual({ kind: 'future' });
    });

    it('rejects implausibly old dates', () => {
      expect(assessDateOfBirth('1900-01-01', now)).toEqual({
        kind: 'implausible',
      });
    });

    it('rejects malformed input', () => {
      expect(assessDateOfBirth('not-a-date', now)).toEqual({ kind: 'invalid' });
      expect(assessDateOfBirth('2013-02-30', now)).toEqual({ kind: 'invalid' });
    });

    it('evaluates against the UTC calendar date, not the local clock', () => {
      // 23:30 UTC on 10 November is already 11 November in zones ahead of UTC,
      // but the conservative UTC date still treats the user as 12.
      const lateEvening = new Date('2026-11-10T23:30:00.000Z');
      expect(toUtcCalendarDate(lateEvening)).toEqual({
        year: 2026,
        month: 11,
        day: 10,
      });
      expect(assessDateOfBirth('2013-11-11', lateEvening)).toEqual({
        kind: 'under_age',
      });
    });

    it('honours a stricter configured minimum age', () => {
      expect(assessDateOfBirth('2012-01-01', now, 16)).toEqual({
        kind: 'under_age',
      });
      expect(assessDateOfBirth('2010-01-01', now, 16)).toEqual({
        kind: 'eligible',
        age: 16,
      });
    });
  });

  describe('hashLockoutIdentifier', () => {
    it('is deterministic, case and whitespace insensitive, and 64 hex characters', () => {
      const a = hashLockoutIdentifier('Parent@Example.com ', 'secret');
      const b = hashLockoutIdentifier('parent@example.com', 'secret');

      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{64}$/);
    });

    it('does not contain the address and depends on the server secret', () => {
      const withFirstSecret = hashLockoutIdentifier('kid@example.com', 'one');
      const withSecondSecret = hashLockoutIdentifier('kid@example.com', 'two');

      expect(withFirstSecret).not.toContain('kid');
      expect(withFirstSecret).not.toBe(withSecondSecret);
    });

    it('normalises addresses consistently', () => {
      expect(normaliseEmailForLockout('  A@B.C ')).toBe('a@b.c');
    });
  });
});
