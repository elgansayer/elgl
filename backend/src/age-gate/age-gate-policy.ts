import { createHmac } from 'node:crypto';
import { COPPA_MINIMUM_AGE, MAXIMUM_PLAUSIBLE_AGE } from './age-gate.constants';

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export type AgeAssessment =
  | { kind: 'invalid' }
  | { kind: 'future' }
  | { kind: 'implausible' }
  | { kind: 'under_age' }
  | { kind: 'eligible'; age: number };

const ISO_CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a strict `YYYY-MM-DD` calendar date. Impossible dates such as
 * 2011-02-30 return null instead of silently rolling into the next month.
 */
export function parseCalendarDate(value: string): CalendarDate | null {
  const match = ISO_CALENDAR_DATE.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

/** The server's current UTC calendar date. */
export function toUtcCalendarDate(instant: Date): CalendarDate {
  return {
    year: instant.getUTCFullYear(),
    month: instant.getUTCMonth() + 1,
    day: instant.getUTCDate(),
  };
}

function compareCalendarDates(a: CalendarDate, b: CalendarDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

/** Completed years between two calendar dates (birthday-aware). */
export function calculateAge(
  dateOfBirth: CalendarDate,
  today: CalendarDate,
): number {
  let age = today.year - dateOfBirth.year;
  const birthdayPassed =
    today.month > dateOfBirth.month ||
    (today.month === dateOfBirth.month && today.day >= dateOfBirth.day);
  if (!birthdayPassed) age -= 1;
  return age;
}

/**
 * Classifies a declared date of birth against the server clock. Ages are
 * evaluated against the UTC calendar date, which is the conservative choice
 * for a child's final day below the threshold in zones ahead of UTC.
 */
export function assessDateOfBirth(
  value: string,
  now: Date,
  minimumAge: number = COPPA_MINIMUM_AGE,
): AgeAssessment {
  const dateOfBirth = parseCalendarDate(value);
  if (!dateOfBirth) return { kind: 'invalid' };

  const today = toUtcCalendarDate(now);
  if (compareCalendarDates(dateOfBirth, today) > 0) return { kind: 'future' };

  const age = calculateAge(dateOfBirth, today);
  if (age > MAXIMUM_PLAUSIBLE_AGE) return { kind: 'implausible' };
  if (age < minimumAge) return { kind: 'under_age' };

  return { kind: 'eligible', age };
}

/**
 * Keyed, domain-separated hash of a mailbox for the lockout table. The raw
 * address is never stored, and without the server secret the hashes cannot be
 * matched against a list of known addresses.
 */
export function hashLockoutIdentifier(
  email: string,
  serverSecret: string,
): string {
  const key = createHmac('sha256', serverSecret)
    .update('age-gate-lockout-v1')
    .digest();
  return createHmac('sha256', key)
    .update(normaliseEmailForLockout(email))
    .digest('hex');
}

export function normaliseEmailForLockout(email: string): string {
  return email.trim().toLowerCase();
}
