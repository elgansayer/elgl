import { SetMetadata } from '@nestjs/common';

export const AGE_GATE_EXEMPT_METADATA_KEY = 'age-gate:exempt';

/**
 * Marks a route (or controller) that an authenticated account must still be able
 * to reach before it has passed the age gate: the gate itself and the
 * account-closure endpoints. Everything else is blocked by SupabaseAuthGuard.
 */
export const AgeGateExempt = (): MethodDecorator & ClassDecorator =>
  SetMetadata(AGE_GATE_EXEMPT_METADATA_KEY, true);
