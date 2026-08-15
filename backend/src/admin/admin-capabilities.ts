export const ADMIN_BOOTSTRAP_CAPABILITIES = [
  'users.read',
  'users.manage',
  'moderation.cases.read',
  'moderation.cases.manage',
  'audit.read',
  'logs.read',
  'system.health.read',
] as const;

export type AdminCapability = (typeof ADMIN_BOOTSTRAP_CAPABILITIES)[number];
