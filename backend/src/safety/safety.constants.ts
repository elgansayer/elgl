/**
 * Single source of truth for the block and report contract.
 *
 * The DTO validators, the service rules, the category catalogue returned to
 * clients and the database constraints (see
 * `supabase/migrations/20261104090000_harden_block_and_report_invariants.sql`)
 * all derive from these values so they cannot drift apart.
 */

/** Reason categories a person may choose when reporting a user or business. */
export const SAFETY_REPORT_CATEGORY_VALUES = [
  'harassment',
  'spam',
  'inappropriate_content',
  'fake_profile',
  'other',
] as const;

export type SafetyReportCategory =
  (typeof SAFETY_REPORT_CATEGORY_VALUES)[number];

/** Longest free-text description a reporter may attach to a report. */
export const SAFETY_REPORT_DESCRIPTION_MAX_LENGTH = 500;

/** Longest context link (page the report was raised from) that is stored. */
export const SAFETY_REPORT_CONTEXT_URL_MAX_LENGTH = 2048;

/**
 * Context links are rendered to moderators, so only absolute http(s) links or
 * app-relative paths are accepted. Whitespace, quotes, angle brackets and
 * backslashes are rejected, which also rules out `javascript:` and `data:`
 * links and protocol-relative `//host` forms.
 */
export const SAFETY_REPORT_CONTEXT_URL_PATTERN =
  /^(?:https?:\/\/[^\s<>"'\\]+|\/(?!\/)[^\s<>"'\\]*)$/i;

/**
 * Rolling 24 hour ceiling on distinct reports one account can file. A retry or
 * a repeat of an already open report never counts against it.
 */
export const SAFETY_MAX_REPORTS_PER_REPORTER_PER_DAY = 20;

/** Window used when counting a reporter's recent reports. */
export const SAFETY_REPORT_QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Operations recorded by the safety outcome metric. */
export type SafetyOperation = 'report' | 'block' | 'unblock';

/** Bounded outcome vocabulary for the safety outcome metric. */
export type SafetyOutcome =
  'success' | 'duplicate' | 'rejected' | 'rate_limited' | 'failure';
