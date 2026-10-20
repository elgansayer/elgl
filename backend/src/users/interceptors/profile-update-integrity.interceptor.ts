import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
  NestInterceptor,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, from, map, mergeMap } from 'rxjs';
import { SupabaseService } from '../../supabase/supabase.service';

type ProfileUpdateRequest = Request & {
  user?: { id?: string; sub?: string };
  body?: Record<string, unknown>;
};

type EntitlementRow = {
  is_vip?: boolean | null;
  vip_tier?: string | null;
};

const VERIFIED_PROFILE_FIELDS = [
  'bio_text',
  'native_languages',
  'target_languages',
  'privacy_hide_age',
  'privacy_hide_location',
  'privacy_hide_from_search',
  'privacy_hide_gender',
  'privacy_hide_exact_location',
  'privacy_hide_online_status',
] as const;

type VerifiedProfileField = (typeof VERIFIED_PROFILE_FIELDS)[number];

/**
 * Hardens the existing PATCH /users/me profile update path without creating a
 * second profile store. The controller/service remain the canonical mutation
 * path; this interceptor adds two fail-closed guarantees around it:
 *
 * 1. Multi-target-language access is verified directly against persisted VIP
 *    entitlement and tier instead of trusting a profile fallback value.
 * 2. Core profile/privacy fields requested by the endpoint are read back after
 *    the mutation so a storage failure cannot be reported as a successful
 *    profile update.
 *
 * User IDs, profile values, and provider error text are deliberately excluded
 * from logs.
 */
@Injectable()
export class ProfileUpdateIntegrityInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ProfileUpdateIntegrityInterceptor.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<ProfileUpdateRequest>();

    if (!this.isProfileUpdate(context, request)) {
      return next.handle();
    }

    const userId = request.user?.id ?? request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }

    const body = request.body ?? {};

    return from(this.verifyTargetLanguageEntitlement(userId, body)).pipe(
      mergeMap(() => next.handle()),
      mergeMap((value) =>
        from(this.verifyPersistedProfileUpdate(userId, body)).pipe(
          map(() => value),
        ),
      ),
    );
  }

  private isProfileUpdate(
    context: ExecutionContext,
    request: ProfileUpdateRequest,
  ): boolean {
    return (
      request.method?.toUpperCase() === 'PATCH' &&
      context.getClass().name === 'UsersController' &&
      context.getHandler().name === 'updateMyProfile'
    );
  }

  private async verifyTargetLanguageEntitlement(
    userId: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    const targetLanguages = body['target_languages'];
    if (!Array.isArray(targetLanguages) || targetLanguages.length <= 1) {
      return;
    }

    const supabase = this.supabaseService.getClient();
    const response = (await supabase
      .from('users')
      .select('is_vip,vip_tier')
      .eq('id', userId)
      .maybeSingle()) as unknown as {
      data: EntitlementRow | null;
      error: unknown | null;
    };

    if (response.error) {
      this.logger.warn('Profile update entitlement verification failed');
      throw new ServiceUnavailableException(
        'Unable to verify profile subscription entitlement',
      );
    }

    if (!response.data) {
      throw new NotFoundException('User profile not found');
    }

    if (response.data.is_vip !== true) {
      throw new BadRequestException(
        'Free tier allows a maximum of 1 target language. Upgrade to VIP to study up to 3 languages.',
      );
    }

    const maxLanguages =
      response.data.vip_tier === 'pro' || response.data.vip_tier === 'developer'
        ? 5
        : 3;
    if (targetLanguages.length > maxLanguages) {
      throw new BadRequestException(
        `A maximum of ${maxLanguages} target languages can be studied simultaneously on your current tier.`,
      );
    }
  }

  private async verifyPersistedProfileUpdate(
    userId: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    const fields = VERIFIED_PROFILE_FIELDS.filter(
      (field) => body[field] !== undefined,
    );
    if (fields.length === 0) {
      return;
    }

    const supabase = this.supabaseService.getClient();
    const response = (await supabase
      .from('users')
      .select(fields.join(','))
      .eq('id', userId)
      .maybeSingle()) as unknown as {
      data: Partial<Record<VerifiedProfileField, unknown>> | null;
      error: unknown | null;
    };

    if (response.error) {
      this.logger.warn('Profile update persistence verification failed');
      throw new ServiceUnavailableException(
        'Unable to verify the saved profile update',
      );
    }

    if (!response.data) {
      throw new NotFoundException('User profile not found');
    }

    const persisted = response.data;
    const mismatch = fields.some(
      (field) => !this.valuesEqual(body[field], persisted[field]),
    );

    if (mismatch) {
      this.logger.warn('Profile update did not match persisted profile state');
      throw new InternalServerErrorException(
        'Profile update could not be persisted',
      );
    }
  }

  private valuesEqual(expected: unknown, actual: unknown): boolean {
    if (Array.isArray(expected) || Array.isArray(actual)) {
      if (!Array.isArray(expected) || !Array.isArray(actual)) {
        return false;
      }
      return (
        expected.length === actual.length &&
        expected.every((value, index) => value === actual[index])
      );
    }

    return expected === actual;
  }
}
