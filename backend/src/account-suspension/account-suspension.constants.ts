/** Longest suspension an operator can issue. Longer or permanent bans need step-up and approval first. */
export const MAX_SUSPENSION_DAYS = 90;

/** Shortest useful suspension: guards against an already-expired or clock-skewed request. */
export const MIN_SUSPENSION_MS = 60_000;

/**
 * How long a per-instance authentication-boundary lookup is trusted. This is the
 * worst-case delay before another instance observes an issue or lift.
 */
export const SUSPENSION_CACHE_TTL_MS = 30_000;

/** Hard bound on cached users so the cache cannot grow with the user base. */
export const SUSPENSION_CACHE_MAX_ENTRIES = 10_000;

/** Machine-readable code in the 403 body returned to a suspended account. */
export const ACCOUNT_SUSPENDED_CODE = 'ACCOUNT_SUSPENDED';
