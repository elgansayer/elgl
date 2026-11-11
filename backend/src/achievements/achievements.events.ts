export const ACHIEVEMENTS_EVALUATE_EVENT = 'achievements.evaluate';

/**
 * Progress sources the milestone catalogue can be measured against. Each source
 * is read from persisted data, never from client-supplied counters.
 */
export const MILESTONE_SOURCES = [
  'messages',
  'streak',
  'corrections',
  'moments',
  'lessons',
] as const;

export type MilestoneSource = (typeof MILESTONE_SOURCES)[number];

export interface AchievementsEvaluatePayload {
  userId: string;
  /** Limits evaluation to these sources. Omit to evaluate every source. */
  sources?: readonly MilestoneSource[];
}
