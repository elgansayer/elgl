import { SetMetadata } from '@nestjs/common';

/** Request header the first-party clients use to declare their build version. */
export const CLIENT_VERSION_HEADER = 'x-app-version';

/** Machine-readable code in the HTTP 426 body so clients can branch safely. */
export const CLIENT_UPGRADE_REQUIRED_CODE = 'CLIENT_UPGRADE_REQUIRED';

export const CLIENT_VERSION_ENFORCEMENT_MODES = [
  'enforce',
  'report-only',
  'off',
] as const;

export type ClientVersionEnforcementMode =
  (typeof CLIENT_VERSION_ENFORCEMENT_MODES)[number];

export const ALLOW_OUTDATED_CLIENT_KEY = 'allowOutdatedClient';

/**
 * Marks a route (or controller) as reachable by clients below the minimum
 * supported version. Needed for the version policy endpoints themselves, so an
 * outdated client can always discover what it must upgrade to.
 */
export const AllowOutdatedClient = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_OUTDATED_CLIENT_KEY, true);

export type ClientVersionStatus =
  'supported' | 'update_available' | 'upgrade_required' | 'unknown';

export interface ClientVersionEvaluation {
  status: ClientVersionStatus;
  minimumSupported: string;
  latest: string;
  updateUrl?: string;
}
