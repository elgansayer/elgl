import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { normalizeAdminOperatorNote } from './admin-action-reasons';
import { AdminNetworkBlockScope } from './dto/admin-network-abuse.dto';
import {
  CreateAdminNetworkProviderAllowlistDto,
  CreateAdminNetworkProviderBlockDto,
  MAX_PUBLIC_ASN,
} from './dto/admin-network-provider.dto';

export interface TrustedNetworkProviderContext {
  asn: number;
  provider: string | null;
  isHostingProvider: boolean;
}

export interface AdminNetworkProviderReputation {
  asn: number;
  provider: string;
  isHostingProvider: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  signals: string[];
  requestsToday: number;
  requests7d: number;
  activeDays7d: number;
  latestSeenAt: string | null;
  allowlisted: boolean;
  activeBlocks: Array<{
    id: string;
    scope: AdminNetworkBlockScope;
    expiresAt: string;
  }>;
}

export interface AdminNetworkProviderImpactPreview {
  asn: number;
  provider: string;
  isHostingProvider: boolean;
  scope: AdminNetworkBlockScope;
  observedRequests30d: number;
  observedDays30d: number;
  latestSeenAt: string | null;
  allowlisted: boolean;
}

export interface AdminNetworkProviderBlock {
  id: string;
  asn: number;
  providerSnapshot: string | null;
  scope: AdminNetworkBlockScope;
  reasonCode: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface AdminNetworkProviderAllowlistEntry {
  id: string;
  asn: number;
  providerSnapshot: string | null;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

const MAX_BLOCK_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_BLOCK_DURATION_MS = 5 * 60 * 1000;
const DECISION_CACHE_SECONDS = 30;
const DECISION_CACHE_EPOCH_KEY = 'network-abuse:v1:epoch';
const MAX_PROVIDER_LENGTH = 120;

@Injectable()
export class AdminNetworkProviderService {
  private readonly logger = new Logger(AdminNetworkProviderService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async lookup(asnInput: number): Promise<AdminNetworkProviderReputation> {
    const asn = this.normalizeAsn(asnInput);
    const { data, error } = await this.client().rpc(
      'admin_network_provider_reputation',
      { p_asn: asn },
    );
    if (error) throw error;
    return this.mapReputation(data, asn);
  }

  async preview(
    asnInput: number,
    scope: AdminNetworkBlockScope,
  ): Promise<AdminNetworkProviderImpactPreview> {
    const asn = this.normalizeAsn(asnInput);
    const { data, error } = await this.client().rpc(
      'admin_network_provider_block_impact',
      { p_asn: asn },
    );
    if (error) throw error;
    const payload = this.asRecord(data);
    return {
      asn,
      provider: this.safeProvider(payload.provider),
      isHostingProvider: payload.is_hosting_provider === true,
      scope,
      observedRequests30d: this.safeCount(payload.observed_requests_30d),
      observedDays30d: this.safeCount(payload.observed_days_30d),
      latestSeenAt:
        typeof payload.latest_seen_at === 'string'
          ? payload.latest_seen_at
          : null,
      allowlisted: payload.allowlisted === true,
    };
  }

  async listBlocks(limit = 50): Promise<AdminNetworkProviderBlock[]> {
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const { data, error } = await this.client()
      .from('admin_network_provider_blocks')
      .select(
        'id, asn, provider_snapshot, scope, reason_code, expires_at, created_at, revoked_at',
      )
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(boundedLimit);
    if (error) throw error;
    return (data ?? []).map((row) =>
      this.mapBlock(row as Record<string, unknown>),
    );
  }

  async listAllowlist(
    limit = 50,
  ): Promise<AdminNetworkProviderAllowlistEntry[]> {
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const { data, error } = await this.client()
      .from('admin_network_provider_allowlist')
      .select(
        'id, asn, provider_snapshot, reason, expires_at, created_at, revoked_at',
      )
      .is('revoked_at', null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(boundedLimit);
    if (error) throw error;
    return (data ?? []).map((row) =>
      this.mapAllowlist(row as Record<string, unknown>),
    );
  }

  async createBlock(
    actorUserId: string,
    input: CreateAdminNetworkProviderBlockDto,
  ): Promise<AdminNetworkProviderBlock> {
    const asn = this.normalizeAsn(input.asn);
    const expiresAt = this.validateBlockExpiry(input.expiresAt);
    const operatorNote = normalizeAdminOperatorNote(input.operatorNote);
    const existing = await this.findBlockByIdempotency(
      actorUserId,
      input.idempotencyKey,
    );
    if (existing) return existing;

    const providerSnapshot = await this.providerSnapshot(asn);
    const { data, error } = await this.client()
      .from('admin_network_provider_blocks')
      .insert({
        asn,
        provider_snapshot: providerSnapshot,
        scope: input.scope,
        reason_code: input.reasonCode,
        operator_note: operatorNote,
        expires_at: expiresAt,
        created_by: actorUserId,
        idempotency_key: input.idempotencyKey,
      })
      .select(
        'id, asn, provider_snapshot, scope, reason_code, expires_at, created_at, revoked_at',
      )
      .single();
    if (error) throw error;
    await this.invalidateDecisionCache();
    return this.mapBlock(data);
  }

  async revokeBlock(
    actorUserId: string,
    blockId: string,
  ): Promise<AdminNetworkProviderBlock> {
    const existing = await this.getBlock(blockId);
    if (existing.revokedAt) return existing;

    const now = new Date().toISOString();
    const { data, error } = await this.client()
      .from('admin_network_provider_blocks')
      .update({ revoked_at: now, revoked_by: actorUserId })
      .eq('id', blockId)
      .is('revoked_at', null)
      .select(
        'id, asn, provider_snapshot, scope, reason_code, expires_at, created_at, revoked_at',
      )
      .maybeSingle();
    if (error) throw error;
    await this.invalidateDecisionCache();
    return data ? this.mapBlock(data) : this.getBlock(blockId);
  }

  async createAllowlist(
    actorUserId: string,
    input: CreateAdminNetworkProviderAllowlistDto,
  ): Promise<AdminNetworkProviderAllowlistEntry> {
    const asn = this.normalizeAsn(input.asn);
    const expiresAt = input.expiresAt
      ? this.validateOptionalExpiry(input.expiresAt)
      : null;
    const existing = await this.findAllowlistByIdempotency(
      actorUserId,
      input.idempotencyKey,
    );
    if (existing) return existing;

    const providerSnapshot = await this.providerSnapshot(asn);
    const { data, error } = await this.client()
      .from('admin_network_provider_allowlist')
      .insert({
        asn,
        provider_snapshot: providerSnapshot,
        reason: input.reason.trim(),
        expires_at: expiresAt,
        created_by: actorUserId,
        idempotency_key: input.idempotencyKey,
      })
      .select(
        'id, asn, provider_snapshot, reason, expires_at, created_at, revoked_at',
      )
      .single();
    if (error) throw error;
    await this.invalidateDecisionCache();
    return this.mapAllowlist(data);
  }

  async revokeAllowlist(
    actorUserId: string,
    entryId: string,
  ): Promise<AdminNetworkProviderAllowlistEntry> {
    const existing = await this.getAllowlist(entryId);
    if (existing.revokedAt) return existing;

    const now = new Date().toISOString();
    const { data, error } = await this.client()
      .from('admin_network_provider_allowlist')
      .update({ revoked_at: now, revoked_by: actorUserId })
      .eq('id', entryId)
      .is('revoked_at', null)
      .select(
        'id, asn, provider_snapshot, reason, expires_at, created_at, revoked_at',
      )
      .maybeSingle();
    if (error) throw error;
    await this.invalidateDecisionCache();
    return data ? this.mapAllowlist(data) : this.getAllowlist(entryId);
  }

  async recordSignal(
    context: TrustedNetworkProviderContext,
    scope: AdminNetworkBlockScope,
  ): Promise<void> {
    if (scope === 'all') return;
    let asn: number;
    try {
      asn = this.normalizeAsn(context.asn);
    } catch {
      return;
    }
    const provider = this.normalizeProvider(context.provider) ?? 'unknown';
    try {
      const { error } = await this.client().rpc('record_network_provider_signal', {
        p_asn: asn,
        p_provider: provider,
        p_is_hosting: context.isHostingProvider,
        p_scope: scope,
      });
      if (error) throw error;
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'network_provider_signal_write_failed',
          asn,
          scope,
          errorType: error instanceof Error ? error.name : 'DatabaseError',
        }),
      );
    }
  }

  async isRequestBlocked(
    asnInput: number | undefined,
    scope: AdminNetworkBlockScope,
  ): Promise<boolean> {
    if (asnInput === undefined) return false;
    let asn: number;
    try {
      asn = this.normalizeAsn(asnInput);
    } catch {
      return false;
    }

    const redis = this.supabaseService.getRedisClient();
    let epoch = '0';
    try {
      epoch = (await redis.get(DECISION_CACHE_EPOCH_KEY)) ?? '0';
    } catch {
      // PostgreSQL remains authoritative when Redis is degraded.
    }
    const key = `network-abuse:provider:${epoch}:${asn}:${scope}`;
    try {
      const cached = await redis.get(key);
      if (cached === '1') return true;
      if (cached === '0') return false;
    } catch {
      // PostgreSQL remains authoritative when Redis is degraded.
    }

    try {
      const { data, error } = await this.client().rpc(
        'is_network_provider_request_blocked',
        { p_asn: asn, p_scope: scope },
      );
      if (error) throw error;
      const blocked = data === true;
      try {
        await redis.set(key, blocked ? '1' : '0', 'EX', DECISION_CACHE_SECONDS);
      } catch {
        // Cache failure must not change the authorization decision.
      }
      return blocked;
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'network_provider_enforcement_lookup_failed',
          asn,
          scope,
          errorType: error instanceof Error ? error.name : 'DatabaseError',
        }),
      );
      return false;
    }
  }

  normalizeAsn(input: number): number {
    const asn = Number(input);
    if (!Number.isInteger(asn) || asn < 1 || asn > MAX_PUBLIC_ASN) {
      throw new BadRequestException('ASN must be an integer from 1 through 4294967295');
    }
    return asn;
  }

  normalizeProvider(input: string | null | undefined): string | null {
    if (typeof input !== 'string') return null;
    const value = input.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    if (!value) return null;
    return value.slice(0, MAX_PROVIDER_LENGTH);
  }

  private client(): SupabaseClient {
    return this.supabaseService.getClient();
  }

  private async getBlock(id: string): Promise<AdminNetworkProviderBlock> {
    const { data, error } = await this.client()
      .from('admin_network_provider_blocks')
      .select(
        'id, asn, provider_snapshot, scope, reason_code, expires_at, created_at, revoked_at',
      )
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Network provider block not found');
    return this.mapBlock(data);
  }

  private async getAllowlist(
    id: string,
  ): Promise<AdminNetworkProviderAllowlistEntry> {
    const { data, error } = await this.client()
      .from('admin_network_provider_allowlist')
      .select(
        'id, asn, provider_snapshot, reason, expires_at, created_at, revoked_at',
      )
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new NotFoundException('Network provider allowlist entry not found');
    }
    return this.mapAllowlist(data);
  }

  private async findBlockByIdempotency(
    actorUserId: string,
    key: string,
  ): Promise<AdminNetworkProviderBlock | null> {
    const { data, error } = await this.client()
      .from('admin_network_provider_blocks')
      .select(
        'id, asn, provider_snapshot, scope, reason_code, expires_at, created_at, revoked_at',
      )
      .eq('created_by', actorUserId)
      .eq('idempotency_key', key)
      .maybeSingle();
    if (error) throw error;
    return data ? this.mapBlock(data) : null;
  }

  private async findAllowlistByIdempotency(
    actorUserId: string,
    key: string,
  ): Promise<AdminNetworkProviderAllowlistEntry | null> {
    const { data, error } = await this.client()
      .from('admin_network_provider_allowlist')
      .select(
        'id, asn, provider_snapshot, reason, expires_at, created_at, revoked_at',
      )
      .eq('created_by', actorUserId)
      .eq('idempotency_key', key)
      .maybeSingle();
    if (error) throw error;
    return data ? this.mapAllowlist(data) : null;
  }

  private async providerSnapshot(asn: number): Promise<string | null> {
    try {
      const reputation = await this.lookup(asn);
      return reputation.provider === 'unknown' ? null : reputation.provider;
    } catch {
      return null;
    }
  }

  private validateBlockExpiry(value: string): string {
    const timestamp = Date.parse(value);
    const duration = timestamp - Date.now();
    if (
      !Number.isFinite(timestamp) ||
      duration < MIN_BLOCK_DURATION_MS ||
      duration > MAX_BLOCK_DURATION_MS
    ) {
      throw new BadRequestException(
        'Network provider blocks must expire between 5 minutes and 30 days from now',
      );
    }
    return new Date(timestamp).toISOString();
  }

  private validateOptionalExpiry(value: string): string {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
      throw new BadRequestException('Allowlist expiry must be in the future');
    }
    return new Date(timestamp).toISOString();
  }

  private mapReputation(
    data: unknown,
    fallbackAsn: number,
  ): AdminNetworkProviderReputation {
    const payload = this.asRecord(data);
    const risk = payload.risk_level;
    const activeBlocks = Array.isArray(payload.active_blocks)
      ? payload.active_blocks.map((item) => {
          const row = this.asRecord(item);
          return {
            id: String(row.id ?? ''),
            scope: this.toScope(row.scope),
            expiresAt: String(row.expires_at ?? ''),
          };
        })
      : [];
    return {
      asn: this.safeAsn(payload.asn, fallbackAsn),
      provider: this.safeProvider(payload.provider),
      isHostingProvider: payload.is_hosting_provider === true,
      riskLevel: risk === 'high' || risk === 'medium' ? risk : 'low',
      signals: Array.isArray(payload.signals)
        ? payload.signals.filter(
            (value): value is string => typeof value === 'string',
          )
        : [],
      requestsToday: this.safeCount(payload.requests_today),
      requests7d: this.safeCount(payload.requests_7d),
      activeDays7d: this.safeCount(payload.active_days_7d),
      latestSeenAt:
        typeof payload.latest_seen_at === 'string'
          ? payload.latest_seen_at
          : null,
      allowlisted: payload.allowlisted === true,
      activeBlocks,
    };
  }

  private mapBlock(row: Record<string, unknown>): AdminNetworkProviderBlock {
    return {
      id: String(row.id),
      asn: this.safeAsn(row.asn, 0),
      providerSnapshot:
        typeof row.provider_snapshot === 'string' ? row.provider_snapshot : null,
      scope: this.toScope(row.scope),
      reasonCode: String(row.reason_code),
      expiresAt: String(row.expires_at),
      createdAt: String(row.created_at),
      revokedAt: typeof row.revoked_at === 'string' ? row.revoked_at : null,
    };
  }

  private mapAllowlist(
    row: Record<string, unknown>,
  ): AdminNetworkProviderAllowlistEntry {
    return {
      id: String(row.id),
      asn: this.safeAsn(row.asn, 0),
      providerSnapshot:
        typeof row.provider_snapshot === 'string' ? row.provider_snapshot : null,
      reason: String(row.reason),
      expiresAt: typeof row.expires_at === 'string' ? row.expires_at : null,
      createdAt: String(row.created_at),
      revokedAt: typeof row.revoked_at === 'string' ? row.revoked_at : null,
    };
  }

  private safeProvider(value: unknown): string {
    return this.normalizeProvider(typeof value === 'string' ? value : null) ?? 'unknown';
  }

  private safeAsn(value: unknown, fallback: number): number {
    const asn = Number(value);
    return Number.isInteger(asn) && asn >= 1 && asn <= MAX_PUBLIC_ASN
      ? asn
      : fallback;
  }

  private safeCount(value: unknown): number {
    const count = Number(value);
    return Number.isFinite(count) && count >= 0 ? Math.trunc(count) : 0;
  }

  private toScope(value: unknown): AdminNetworkBlockScope {
    return value === 'auth' || value === 'write' ? value : 'all';
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }

  private async invalidateDecisionCache(): Promise<void> {
    try {
      await this.supabaseService
        .getRedisClient()
        .incr(DECISION_CACHE_EPOCH_KEY);
    } catch {
      // Decisions expire after 30 seconds, so cache invalidation is best effort.
    }
  }
}
