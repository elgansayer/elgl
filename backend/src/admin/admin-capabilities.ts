export const ADMIN_CAPABILITIES = [
  'users.read',
  'users.manage',
  'users.sessions.read',
  'moderation.cases.read',
  'moderation.cases.manage',
  'security.network.read',
  'security.network.manage',
  'roles.read',
  'audit.read',
  'logs.read',
  'system.health.read',
] as const;

// Kept as an alias while the dedicated portal migrates from the legacy
// hard-coded bootstrap response to persisted role assignments.
export const ADMIN_BOOTSTRAP_CAPABILITIES = ADMIN_CAPABILITIES;

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number];

const ADMIN_CAPABILITY_SET = new Set<string>(ADMIN_CAPABILITIES);

export function isAdminCapability(value: string): value is AdminCapability {
  return ADMIN_CAPABILITY_SET.has(value);
}
