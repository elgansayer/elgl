import {
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import {
  AGE_GATE_ERROR_CODES,
  AGE_GATE_STATUS_CACHE_MAX_ENTRIES,
  AGE_GATE_STATUS_CACHE_TTL_MS,
  AgeGateStatus,
  isAgeGateStatus,
} from './age-gate.constants';

export type AgeGateDecision =
  | { allowed: true }
  | {
      allowed: false;
      code:
        | typeof AGE_GATE_ERROR_CODES.required
        | typeof AGE_GATE_ERROR_CODES.blocked;
    };

const ALLOWED: AgeGateDecision = { allowed: true };

/**
 * Read side of the age gate, consulted by SupabaseAuthGuard on every
 * authenticated request. It owns the enforcement rules so the guard stays a
 * thin adapter.
 */
@Injectable()
export class AgeGateStatusService {
  private readonly logger = new Logger(AgeGateStatusService.name);
  /** user id -> expiry (epoch ms). Only 'passed' is cached. */
  private readonly passedUntil = new Map<string, number>();
  private invalidEnforcementDateReported = false;

  constructor(
    private readonly supabaseService: SupabaseService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async evaluate(
    userId: string,
    now: Date = new Date(),
  ): Promise<AgeGateDecision> {
    const cachedUntil = this.passedUntil.get(userId);
    if (cachedUntil !== undefined) {
      if (cachedUntil > now.getTime()) return ALLOWED;
      this.passedUntil.delete(userId);
    }

    const status = await this.getStatus(userId);
    const decision = this.decide(status, now);
    if (status === 'passed') this.rememberPassed(userId, now);
    return decision;
  }

  /** Pure enforcement rule for an already-known status. */
  decide(status: AgeGateStatus, now: Date = new Date()): AgeGateDecision {
    switch (status) {
      case 'passed':
        return ALLOWED;
      case 'legacy':
        return this.isLegacyEnforced(now)
          ? { allowed: false, code: AGE_GATE_ERROR_CODES.required }
          : ALLOWED;
      case 'blocked_under_age':
        return { allowed: false, code: AGE_GATE_ERROR_CODES.blocked };
      case 'required':
        return { allowed: false, code: AGE_GATE_ERROR_CODES.required };
    }
  }

  /**
   * Current status straight from the database. A missing row or an unknown
   * value fails closed as 'required'; an unreadable database is a 503 because
   * no safe answer exists.
   */
  async getStatus(userId: string): Promise<AgeGateStatus> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('age_gate_status')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      this.logger.error('age_gate_status_lookup_failed');
      throw new ServiceUnavailableException(
        'Unable to verify age assurance status',
      );
    }

    return isAgeGateStatus(data?.age_gate_status)
      ? data.age_gate_status
      : 'required';
  }

  /** Forget cached state after this instance changed the account's status. */
  invalidate(userId: string): void {
    this.passedUntil.delete(userId);
  }

  /** Instant at which grandfathered accounts must also pass, or null. */
  legacyEnforcementStart(): Date | null {
    const configured = this.configService
      ?.get<string>('AGE_GATE_LEGACY_ENFORCEMENT_FROM')
      ?.trim();
    if (!configured) return null;

    const parsed = new Date(configured);
    if (Number.isNaN(parsed.getTime())) {
      if (!this.invalidEnforcementDateReported) {
        this.invalidEnforcementDateReported = true;
        this.logger.error('age_gate_legacy_enforcement_date_invalid');
      }
      // Fail closed: an unreadable rollout date must not exempt anyone.
      return new Date(0);
    }
    return parsed;
  }

  private isLegacyEnforced(now: Date): boolean {
    const start = this.legacyEnforcementStart();
    return start !== null && now.getTime() >= start.getTime();
  }

  private rememberPassed(userId: string, now: Date): void {
    if (this.passedUntil.size >= AGE_GATE_STATUS_CACHE_MAX_ENTRIES) {
      const oldest = this.passedUntil.keys().next();
      if (!oldest.done) this.passedUntil.delete(oldest.value);
    }
    this.passedUntil.set(userId, now.getTime() + AGE_GATE_STATUS_CACHE_TTL_MS);
  }
}
