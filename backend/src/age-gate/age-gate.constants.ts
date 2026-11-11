/**
 * Minimum age to hold an account. The Terms of Service and Privacy Policy state
 * 13 (COPPA); raising it for a jurisdiction is a code change reviewed with the
 * legal text, not a runtime toggle.
 */
export const COPPA_MINIMUM_AGE = 13;

/** Declarations older than this are rejected as typing mistakes. */
export const MAXIMUM_PLAUSIBLE_AGE = 120;

/**
 * How long an email address stays locked out after an under-age declaration.
 * The window outlasts the daily erasure run so the address cannot be reused
 * with a different date before the original account has been purged.
 */
export const AGE_GATE_LOCKOUT_HOURS = 168;

/** Only 'passed' is cached: it cannot regress without a server-side action. */
export const AGE_GATE_STATUS_CACHE_TTL_MS = 60_000;
export const AGE_GATE_STATUS_CACHE_MAX_ENTRIES = 10_000;

/** Outcome log retention in months (purged by the maintenance job). */
export const AGE_GATE_EVENT_RETENTION_MONTHS = 24;

/** Rows handled per maintenance pass, so one run never monopolises the database. */
export const AGE_GATE_SWEEP_BATCH_SIZE = 50;

/** Supabase ban duration applied to blocked accounts (effectively permanent). */
export const AGE_GATE_BAN_DURATION = '876000h';

export const AGE_GATE_STATUSES = [
  'legacy',
  'required',
  'passed',
  'blocked_under_age',
] as const;

export type AgeGateStatus = (typeof AGE_GATE_STATUSES)[number];

/** Stable machine-readable codes the client switches on. */
export const AGE_GATE_ERROR_CODES = {
  required: 'AGE_GATE_REQUIRED',
  blocked: 'AGE_GATE_BLOCKED',
  invalidDateOfBirth: 'INVALID_DATE_OF_BIRTH',
} as const;

export type AgeGateErrorCode =
  (typeof AGE_GATE_ERROR_CODES)[keyof typeof AGE_GATE_ERROR_CODES];

export function isAgeGateStatus(value: unknown): value is AgeGateStatus {
  return (
    typeof value === 'string' &&
    (AGE_GATE_STATUSES as readonly string[]).includes(value)
  );
}
