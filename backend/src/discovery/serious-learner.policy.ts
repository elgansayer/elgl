export const SERIOUS_LEARNER_MIN_STREAK_DAYS = 7;
export const SERIOUS_LEARNER_ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface SeriousLearnerActivity {
  study_streak_days?: number | null;
  last_active_at?: string | null;
}

export function getSeriousLearnerActiveSince(now: Date = new Date()): string {
  return new Date(
    now.getTime() - SERIOUS_LEARNER_ACTIVITY_WINDOW_MS,
  ).toISOString();
}

/**
 * Canonical Serious Learner qualification used for discovery and ranking.
 *
 * `is_serious_learner` is a user preference that enables the filter. It is
 * intentionally not evidence that a candidate currently qualifies.
 */
export function isActiveSeriousLearner(
  candidate: SeriousLearnerActivity,
  now: Date = new Date(),
): boolean {
  if ((candidate.study_streak_days ?? 0) < SERIOUS_LEARNER_MIN_STREAK_DAYS) {
    return false;
  }

  if (!candidate.last_active_at) {
    return false;
  }

  const lastActiveMs = Date.parse(candidate.last_active_at);
  if (!Number.isFinite(lastActiveMs)) {
    return false;
  }

  return lastActiveMs >= now.getTime() - SERIOUS_LEARNER_ACTIVITY_WINDOW_MS;
}
