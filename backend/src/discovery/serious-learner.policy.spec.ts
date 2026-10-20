import { describe, expect, it } from 'vitest';
import {
  getSeriousLearnerActiveSince,
  isActiveSeriousLearner,
  SERIOUS_LEARNER_MIN_STREAK_DAYS,
} from './serious-learner.policy';

describe('Serious Learner policy', () => {
  const now = new Date('2026-08-20T12:00:00.000Z');

  it('qualifies a fresh streak at the inclusive seven-day boundary', () => {
    expect(
      isActiveSeriousLearner(
        {
          study_streak_days: SERIOUS_LEARNER_MIN_STREAK_DAYS,
          last_active_at: '2026-08-20T11:59:00.000Z',
        },
        now,
      ),
    ).toBe(true);
  });

  it('rejects streaks below seven days', () => {
    expect(
      isActiveSeriousLearner(
        {
          study_streak_days: SERIOUS_LEARNER_MIN_STREAK_DAYS - 1,
          last_active_at: now.toISOString(),
        },
        now,
      ),
    ).toBe(false);
  });

  it('rejects a stale streak even when the stored counter is high', () => {
    expect(
      isActiveSeriousLearner(
        {
          study_streak_days: 365,
          last_active_at: '2026-08-19T11:59:59.999Z',
        },
        now,
      ),
    ).toBe(false);
  });

  it('treats the exact 24-hour activity boundary as active', () => {
    expect(
      isActiveSeriousLearner(
        {
          study_streak_days: 7,
          last_active_at: '2026-08-19T12:00:00.000Z',
        },
        now,
      ),
    ).toBe(true);
  });

  it('rejects missing or malformed activity timestamps', () => {
    expect(isActiveSeriousLearner({ study_streak_days: 20 }, now)).toBe(false);
    expect(
      isActiveSeriousLearner(
        { study_streak_days: 20, last_active_at: 'not-a-date' },
        now,
      ),
    ).toBe(false);
  });

  it('produces the same 24-hour cutoff used by database filters', () => {
    expect(getSeriousLearnerActiveSince(now)).toBe('2026-08-19T12:00:00.000Z');
  });
});
