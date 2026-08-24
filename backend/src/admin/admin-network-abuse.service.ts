import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { normalizeAdminOperatorNote } from './admin-action-reasons';
import {
  AdminNetworkBlockScope,
  CreateAdminNetworkAllowlistDto,
  CreateAdminNetworkBlockDto,
} from './dto/admin-network-abuse.dto';

export interface AdminNetworkReputation {
  network: string;
  riskLevel: 'low' | 'medium' | 'high';
  signals: string[];
  loginEvents24h: number;
  loginEvents7d: number;
  uniqueAccounts7d: number;
  latestSeenAt: string | null;
  allowlisted: boolean;
  activeBlocks: Array<{
    id: string;
    network: string;
    scope: AdminNetworkBlockScope;
    expiresAt: string;
  }>;
}

export interface AdminNetworkImpactPreview {
  network: string;
  scope: AdminNetworkBlockScope;
  observedLoginEvents30d: number;
  observedAccounts30d: number;
  allowlistConflicts: string[];
}

export interface AdminNetworkBlock {
  id: string;
  network: string;
  scope: AdminNetworkBlockScope;
  reasonCode: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface AdminNetworkAllowlistEntry {
  id: string;
  network: string;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

const MAX_BLOCK_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_BLOCK_DURATION_MS = 5 * 60 * 1000;
const DECISION_CACHE_SECONDS = 30;
const DECISION_CACHE_EPOCH_KEY = 'network-abuse:v1:epoch';

@Injectable()
export class AdminNetworkAbuseService {
  private readonly logger = new Logger(AdminNetworkAbuseService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async lookup(ipInput: string): Promise<AdminNetworkReputation> {
    const ip = this.normalizePublicIp(ipInput);
    const { data, error } = await this.client().rpc(
      'admin_network_reputation',
      {
        p_ip: ip,
      },
    );
    if (error) throw error;
    return this.mapReputation(data);
  }

  async preview(
    cidrInput: string,
    scope: AdminNetworkBlockScope,
  ): Promise<AdminNetworkImpactPreview> {
    const cidr = this.normalizeCidr(cidrInput);
    const { data, error } = await this.client().rpc(
      'admin_network_block_impact',
      { p_cidr: cidr },
    );
    if (error) this.throwCidrError(error);
    const payload = this.asRecord(data);
    return {
      network: String(payload.network ?? cidr),
      scope,
      observedLoginEvents30d: this.safeCount(payload.observed_login_events_30d),
      observedAccounts30d: this.safeCount(payload.observed_accounts_30d),
      allowlistConflicts: Array.isArray(payload.allowlist_conflicts)
        ? payload.allowlist_conflicts.filter(
            (value): value is string => typeof value === 'string',
          )
        : [],
    };
  }

  async listBlocks(limit = 50): Promise<AdminNetworkBlock[]> {
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const { data, error } = await this.client()
      .from('admin_network_blocks')
      .select(
        'id, network, scope, reason_code, expires_at, created_at, revoked_at',
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

  async listAllowlist(limit = 50): Promise<AdminNetworkAllowlistEntry[]> {
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const { data, error } = await this.client()
      .from('admin_network_allowlist')
      .select('id, network, reason, expires_at, created_at, revoked_at')
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
    input: CreateAdminNetworkBlockDto,
  ): Promise<AdminNetworkBlock> {
    const network = this.normalizeCidr(input.cidr);
    const expiresAt = this.validateBlockExpiry(input.expiresAt);
    const operatorNote = normalizeAdminOperatorNote(input.operatorNote);
    const existing = await this.findBlockByIdempotency(
      actorUserId,
      input.idempotencyKey,
    );
    if (existing) return existing;

    const { data, error } = await this.client()
      .from('admin_network_blocks')
      .insert({
        network,
        scope: input.scope,
        reason_code: input.reasonCode,
        operator_note: operatorNote,
        expires_at: expiresAt,
        created_by: actorUserId,
        idempotency_key: input.idempotencyKey,
      })
      .select(
        'id, network, scope, reason_code, expires_at, created_at, revoked_at',
      )
      .single();
    if (error) this.throwCidrError(error);
    await this.invalidateDecisionCache();
    return this.mapBlock(data);
  }

  async revokeBlock(
    actorUserId: string,
    blockId: string,
  ): Promise<AdminNetworkBlock> {
    const existing = await this.getBlock(blockId);
    if (existing.revokedAt) return existing;

    const now = new Date().toISOString();
    const { data, error } = await this.client()
      .from('admin_network_blocks')
      .update({ revoked_at: now, revoked_by: actorUserId })
      .eq('id', blockId)
      .is('revoked_at', null)
      .select(
        'id, network, scope, reason_code, expires_at, created_at, revoked_at',
      )
      .maybeSingle();
    if (error) throw error;
    await this.invalidateDecisionCache();
    return data ? this.mapBlock(data) : this.getBlock(blockId);
  }

  async createAllowlist(
    actorUserId: string,
    input: CreateAdminNetworkAllowlistDto,
  ): Promise<AdminNetworkAllowlistEntry> {
    const network = this.normalizeCidr(input.cidr);
    const expiresAt = input.expiresAt
      ? this.validateOptionalExpiry(input.expiresAt)
      : null;
    const existing = await this.findAllowlistByIdempotency(
      actorUserId,
      input.idempotencyKey,
    );
    if (existing) return existing;

    const { data, error } = await this.client()
      .from('admin_network_allowlist')
      .insert({
        network,
        reason: input.reason.trim(),
        expires_at: expiresAt,
        created_by: actorUserId,
        idempotency_key: input.idempotencyKey,
      })
      .select('id, network, reason, expires_at, created_at, revoked_at')
      .single();
    if (error) this.throwCidrError(error);
    await this.invalidateDecisionCache();
    return this.mapAllowlist(data);
  }

  async revokeAllowlist(
    actorUserId: string,
    entryId: string,
  ): Promise<AdminNetworkAllowlistEntry> {
    const existing = await this.getAllowlist(entryId);
    if (existing.revokedAt) return existing;

    const now = new Date().toISOString();
    const { data, error } = await this.client()
      .from('admin_network_allowlist')
      .update({ revoked_at: now, revoked_by: actorUserId })
      .eq('id', entryId)
      .is('revoked_at', null)
      .select('id, network, reason, expires_at, created_at, revoked_at')
      .maybeSingle();
    if (error) throw error;
    await this.invalidateDecisionCache();
    return data ? this.mapAllowlist(data) : this.getAllowlist(entryId);
  }

  async isRequestBlocked(
    ipInput: string | undefined,
    scope: AdminNetworkBlockScope,
  ): Promise<boolean> {
    if (!ipInput) return false;
    let ip: string;
    try {
      ip = this.normalizePublicIp(ipInput);
    } catch {
      return false;
    }

    const redis = this.supabaseService.getRedisClient();
    let epoch = '0';
    try {
      epoch = (await redis.get(DECISION_CACHE_EPOCH_KEY)) ?? '0';
    } catch {
      // Enforcement can still consult PostgreSQL when Redis is degraded.
    }
    const key = `network-abuse:v1:${epoch}:${this.hashIp(ip)}:${scope}`;
    try {
      const cached = await redis.get(key);
      if (cached === '1') return true;
      if (cached === '0') return false;
    } catch {
      // Enforcement can still consult PostgreSQL when Redis is degraded.
    }

    try {
      const { data, error } = await this.client().rpc(
        'is_network_request_blocked',
        { p_ip: ip, p_scope: scope },
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
          event: 'network_abuse_enforcement_lookup_failed',
          scope,
          errorType: error instanceof Error ? error.name : 'DatabaseError',
        }),
      );
      return false;
    }
  }

  normalizePublicIp(input: string): string {
    const candidate = input.trim().replace(/^::ffff:/i, '');
    const version = isIP(candidate);
    if (version === 0 || this.isUnsafeAddress(candidate, version)) {
      throw new BadRequestException(
        'A public IPv4 or IPv6 address is required',
      );
    }
    return candidate.toLowerCase();
  }

  normalizeCidr(input: string): string {
    const candidate = input.trim();
    const slash = candidate.lastIndexOf('/');
    const address = slash === -1 ? candidate : candidate.slice(0, slash);
    const normalizedAddress = this.normalizePublicIp(address);
    const version = isIP(normalizedAddress);
    const maximum = version === 4 ? 32 : 128;
    const minimum = version === 4 ? 24 : 64;
    const prefix = slash === -1 ? maximum : Number(candidate.slice(slash + 1));
    if (!Number.isInteger(prefix) || prefix < minimum || prefix > maximum) {
      throw new BadRequestException(
        version === 4
          ? 'IPv4 blocks must be /24 through /32'
          : 'IPv6 blocks must be /64 through /128',
      );
    }
    return `${normalizedAddress}/${prefix}`;
  }

  private client(): SupabaseClient {
    return this.supabaseService.getClient();
  }

  private async getBlock(id: string): Promise<AdminNetworkBlock> {
    const { data, error } = await this.client()
      .from('admin_network_blocks')
      .select(
        'id, network, scope, reason_code, expires_at, created_at, revoked_at',
      )
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Network block not found');
    return this.mapBlock(data);
  }

  private async getAllowlist(id: string): Promise<AdminNetworkAllowlistEntry> {
    const { data, error } = await this.client()
      .from('admin_network_allowlist')
      .select('id, network, reason, expires_at, created_at, revoked_at')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Network allowlist entry not found');
    return this.mapAllowlist(data);
  }

  private async findBlockByIdempotency(
    actorUserId: string,
    key: string,
  ): Promise<AdminNetworkBlock | null> {
    const { data, error } = await this.client()
      .from('admin_network_blocks')
      .select(
        'id, network, scope, reason_code, expires_at, created_at, revoked_at',
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
  ): Promise<AdminNetworkAllowlistEntry | null> {
    const { data, error } = await this.client()
      .from('admin_network_allowlist')
      .select('id, network, reason, expires_at, created_at, revoked_at')
      .eq('created_by', actorUserId)
      .eq('idempotency_key', key)
      .maybeSingle();
    if (error) throw error;
    return data ? this.mapAllowlist(data) : null;
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
        'Network blocks must expire between 5 minutes and 30 days from now',
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

  private isUnsafeAddress(address: string, version: number): boolean {
    if (version === 4) {
      const octets = address.split('.').map(Number);
      const [a, b] = octets;
      return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        a >= 224
      );
    }
    const value = address.toLowerCase();
    return (
      value === '::' ||
      value === '::1' ||
      value.startsWith('fc') ||
      value.startsWith('fd') ||
      /^fe[89ab]/.test(value) ||
      value.startsWith('ff')
    );
  }

  private mapReputation(data: unknown): AdminNetworkReputation {
    const payload = this.asRecord(data);
    const risk = payload.risk_level;
    const activeBlocks = Array.isArray(payload.active_blocks)
      ? payload.active_blocks.map((item) => {
          const row = this.asRecord(item);
          return {
            id: String(row.id ?? ''),
            network: String(row.network ?? ''),
            scope: this.toScope(row.scope),
            expiresAt: String(row.expires_at ?? ''),
          };
        })
      : [];
    return {
      network: String(payload.network ?? ''),
      riskLevel: risk === 'high' || risk === 'medium' ? risk : 'low',
      signals: Array.isArray(payload.signals)
        ? payload.signals.filter(
            (value): value is string => typeof value === 'string',
          )
        : [],
      loginEvents24h: this.safeCount(payload.login_events_24h),
      loginEvents7d: this.safeCount(payload.login_events_7d),
      uniqueAccounts7d: this.safeCount(payload.unique_accounts_7d),
      latestSeenAt:
        typeof payload.latest_seen_at === 'string'
          ? payload.latest_seen_at
          : null,
      allowlisted: payload.allowlisted === true,
      activeBlocks,
    };
  }

  private mapBlock(row: Record<string, unknown>): AdminNetworkBlock {
    return {
      id: String(row.id),
      network: String(row.network),
      scope: this.toScope(row.scope),
      reasonCode: String(row.reason_code),
      expiresAt: String(row.expires_at),
      createdAt: String(row.created_at),
      revokedAt: typeof row.revoked_at === 'string' ? row.revoked_at : null,
    };
  }

  private mapAllowlist(
    row: Record<string, unknown>,
  ): AdminNetworkAllowlistEntry {
    return {
      id: String(row.id),
      network: String(row.network),
      reason: String(row.reason),
      expiresAt: typeof row.expires_at === 'string' ? row.expires_at : null,
      createdAt: String(row.created_at),
      revokedAt: typeof row.revoked_at === 'string' ? row.revoked_at : null,
    };
  }

  private toScope(value: unknown): AdminNetworkBlockScope {
    return value === 'auth' || value === 'write' ? value : 'all';
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }

  private safeCount(value: unknown): number {
    const count = Number(value);
    return Number.isFinite(count) && count >= 0 ? Math.trunc(count) : 0;
  }

  private hashIp(ip: string): string {
    return createHash('sha256').update(ip).digest('hex').slice(0, 24);
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

  private throwCidrError(error: unknown): never {
    const message =
      typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : '';
    if (/cidr|network address|inet/i.test(message)) {
      throw new BadRequestException(
        'CIDR must use a valid canonical public network address',
      );
    }
    throw error;
  }
}
