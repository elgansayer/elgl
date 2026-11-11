export const DMCA_NOTICE_STATUSES = [
  'pending_verification',
  'expired',
  'needs_review',
  'content_disabled',
  'counter_notice_received',
  'restored',
  'rejected',
  'withdrawn',
  'litigation_hold',
] as const;

export type DmcaNoticeStatus = (typeof DMCA_NOTICE_STATUSES)[number];

export const DMCA_TARGET_TYPES = ['moment', 'moment_comment'] as const;
export type DmcaTargetType = (typeof DMCA_TARGET_TYPES)[number];

/** States in which the material is (or is being kept) disabled. */
export const DMCA_ACTIVE_STATUSES = [
  'content_disabled',
  'counter_notice_received',
  'litigation_hold',
] as const satisfies readonly DmcaNoticeStatus[];

/** States from which an operator may close a notice by restoring the material. */
export const DMCA_RESTORABLE_STATUSES = [
  'needs_review',
  ...DMCA_ACTIVE_STATUSES,
] as const satisfies readonly DmcaNoticeStatus[];

/** 17 U.S.C. 512(g)(2)(C): restore no sooner than 10 and no later than 14 business days. */
export const DMCA_COUNTER_NOTICE_WAIT_BUSINESS_DAYS = 10;

/** How long a claimant has to confirm the mailbox before the notice lapses. */
export const DMCA_VERIFICATION_TTL_HOURS = 72;

/** A verified notice that has not been processed after this long is retried. */
export const DMCA_STUCK_VERIFIED_MINUTES = 5;

/** Rows accepted from one claimant mailbox per rolling day. */
export const DMCA_MAX_NOTICES_PER_CLAIMANT_PER_DAY = 30;

/** Items per submission (one notice row each). */
export const DMCA_MAX_REFERENCES_PER_SUBMISSION = 10;

/** Active strikes within the window at which the owner is queued for review. */
export const DMCA_REPEAT_INFRINGER_THRESHOLD = 3;
export const DMCA_STRIKE_WINDOW_MONTHS = 12;
export const DMCA_REPEAT_INFRINGER_REASON = 'copyright_repeat_infringer';

export const DMCA_CLOSED_RETENTION_YEARS = 3;
export const DMCA_EXPIRED_RETENTION_DAYS = 30;

export const DMCA_QUARANTINE_PREFIX = 'dmca-quarantine';

export const DMCA_BATCH_SIZE = 25;
export const DMCA_PAGE_SIZE_DEFAULT = 25;
export const DMCA_PAGE_SIZE_MAX = 100;

export const DMCA_ACTOR_TYPES = [
  'claimant',
  'owner',
  'operator',
  'system',
] as const;
export type DmcaActorType = (typeof DMCA_ACTOR_TYPES)[number];

export function isDmcaTargetType(value: unknown): value is DmcaTargetType {
  return (
    typeof value === 'string' &&
    (DMCA_TARGET_TYPES as readonly string[]).includes(value)
  );
}

export function isDmcaNoticeStatus(value: unknown): value is DmcaNoticeStatus {
  return (
    typeof value === 'string' &&
    (DMCA_NOTICE_STATUSES as readonly string[]).includes(value)
  );
}
