export const ADMIN_ACTION_REASON_CODES = [
  'account_security',
  'policy_violation',
  'user_request',
  'legal_request',
  'fraud_or_abuse',
  'moderation_enforcement',
  'support_correction',
  'incident_response',
  'other_reviewed',
] as const;

export type AdminActionReasonCode = (typeof ADMIN_ACTION_REASON_CODES)[number];

const SECRET_LIKE_PATTERN =
  /(authorization\s*:|bearer\s+[a-z0-9._~-]+|password\s*[=:]|token\s*[=:]|api[_-]?key\s*[=:])/i;

export function normalizeAdminOperatorNote(
  value: string | undefined,
): string | null {
  const note = value?.trim();
  if (!note) return null;
  if (note.length > 1000) {
    throw new Error('Admin operator note must be 1000 characters or fewer');
  }
  if (SECRET_LIKE_PATTERN.test(note)) {
    throw new Error('Admin operator note appears to contain a secret');
  }
  return note;
}
