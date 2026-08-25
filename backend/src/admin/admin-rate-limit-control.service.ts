import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { normalizeAdminOperatorNote } from './admin-action-reasons';
import { AdminNetworkAbuseService } from './admin-network-abuse.service';
import {
  AdminNetworkBlockScope,
  CreateAdminNetworkRateLimitDto,
} from './dto/admin-network-abuse.dto';

export interface AdminNetworkRateLimitControl {
  id: string;
  network: string;
  scope: AdminNetworkBlockScope;
  maxRequests: number;
  windowSeconds: number;
  reasonCode: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface AdminNetworkRateLimitInspection {
  network: string;
  scope: AdminNetworkBlockScope;
  activeControl: AdminNetworkRateLimitControl | null;
  currentCount: number;
  remaining: number | null;
  retryAfter: number | null;
}

export interface NetworkRateLimitDecision {
  limited: boolean;
  retryAfter: number;
  controlId?: string;
}

const MIN_CONTROL_DURATION_MS = 5 * 60 * 1000;
const MAX_CONTROL_DURATION_MS = 24 * 60 * 60 * 1000;
const POLICY_CACHE_SECONDS = 30;
const POLICY_CACHE_EPOCH_KEY = 'network-throttle:v1:epoch';

@Injectable()
export class AdminRateLimitControlService {
  private readonly logger = new Logger(AdminRateLimitControlService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly networkAbuse: AdminNetworkAbuseService,
  ) {}

  async list(limit = 50): Promise<AdminNetworkRateLimitControl[]> {
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const { data, error } = await this.client()
      .from('admin_network_rate_limits')
      .select(
        'id, network, scope, max_requests, window_seconds, reason_code, expires_at, created_at, revoked_at',
      )
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(boundedLimit);
    if (error) throw error;
    return (data ?? []).map((row) =>
      this.mapControl(row as Record<string, unknown>),
    );
  }

  async create(
    actorUserId: string,
    input: CreateAdminNetworkRateLimitDto,
  ): Promise<AdminNetworkRateLimitControl> {
    const network = this.networkAbuse.normalizeCidr(input.cidr);
    const expiresAt = this.validateExpiry(input.expiresAt);
    const operatorNote = normalizeAdminOperatorNote(input.operatorNote);
    const existing = await this.findByIdempotency(
      actorUserId,
      input.idempotencyKey,
    );
    if (existing) return existing;

    const { data, error } = await this.client()
      .from('admin_network_rate_limits')
      .insert({
        network,
        scope: input.scope,
        max_requests: input.maxRequests,
        window_seconds: input.windowSeconds,
        reason_code: input.reasonCode,
        operator_note: operatorNote,
        expires_at: expiresAt,
        created_by: actorUserId,
        idempotency_key: input.idempotencyKey,
      })
      .select(
        'id, network, scope, max_requests, window_seconds, reason_code, expires_at, created_at, revoked_at',
      )
      .single();
    if (error) throw error;
    await this.invalidatePolicyCache();
    return this.mapControl(data as Record<string, unknown>);
  }

  async revoke(
    actorUserId: string,
    controlId: string,
  ): Promise<AdminNetworkRateLimitControl> {
    const existing = await this.get(controlId);
    if (existing.revokedAt) return existing;

    const now = new Date().toISOString();
    const { data, error } = await this.client()
      .from('admin_network_rate_limits')
      .update({ revoked_at: now, revoked_by: actorUserId })
      .eq('id', controlId)
      .is('revoked_at', null)
      .select(
        'id, network, scope, max_requests, window_seconds, reason_code, expires_at, created_at, revoked_at',
      )
      .maybeSingle();
    if (error) throw error;
    await this.invalidatePolicyCache();
    return data
      ? this.mapControl(data as Record<string, unknown>)
      : this.get(controlId);
  }

  async inspect(
    ipInput: string,
    scope: AdminNetworkBlockScope,
  ): Promise<AdminNetworkRateLimitInspection> {
    const ip = this.networkAbuse.normalizePublicIp(ipInput);
    const control = await this.resolveControl(ip, scope);
    if (!control) {
      return {
        network: this.coarseNetwork(ip),
        scope,
        activeControl: null,
        currentCount: 0,
        remaining: null,
        retryAfter: null,
      };
    }

    const bucket = this.bucket(control.windowSeconds);
    const key = this.counterKey(control, ip, bucket);
    let currentCount = 0;
    let retryAfter = this.secondsUntilNextBucket(control.windowSeconds);
    try {
      const redis = this.supabaseService.getRedisClient();
      currentCount = this.safeCount(await redis.get(key));
      const ttl = await redis.ttl(key);
      if (ttl > 0) retryAfter = ttl;
    } catch {
      // Inspection remains useful when Redis is unavailable. Do not fabricate hits.
    }

    return {
      network: this.coarseNetwork(ip),
      scope,
      activeControl: control,
      currentCount,
      remaining: Math.max(control.maxRequests - currentCount, 0),
      retryAfter: currentCount >= control.maxRequests ? retryAfter : null,
    };
  }

  async consume(
    ipInput: string | undefined,
    scope: AdminNetworkBlockScope,
  ): Promise<NetworkRateLimitDecision> {
    if (!ipInput) return { limited: false, retryAfter: 0 };

    let ip: string;
    try {
      ip = this.networkAbuse.normalizePublicIp(ipInput);
    } catch {
      return { limited: false, retryAfter: 0 };
    }

    const control = await this.resolveControl(ip, scope);
    if (!control) return { limited: false, retryAfter: 0 };

    try {
      const redis = this.supabaseService.getRedisClient();
      const bucket = this.bucket(control.windowSeconds);
      const key = this.counterKey(control, ip, bucket);
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, control.windowSeconds + 2);
      }
      if (count <= control.maxRequests) {
        return { limited: false, retryAfter: 0, controlId: control.id };
      }

      const ttl = await redis.ttl(key);
      return {
        limited: true,
        retryAfter:
          ttl > 0 ? ttl : this.secondsUntilNextBucket(control.windowSeconds),
        controlId: control.id,
      };
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'admin_network_rate_limit_enforcement_failed',
          scope,
          errorType: error instanceof Error ? error.name : 'RedisError',
        }),
      );
      // These controls only add stricter emergency throttles. Existing application
      // rate limiters continue to enforce their own limits during Redis degradation.
      return { limited: false, retryAfter: 0, controlId: control.id };
    }
  }

  private async resolveControl(
    ip: string,
    scope: AdminNetworkBlockScope,
  ): Promise<AdminNetworkRateLimitControl | null> {
    const redis = this.supabaseService.getRedisClient();
    let epoch = '0';
    try {
      epoch = (await redis.get(POLICY_CACHE_EPOCH_KEY)) ?? '0';
    } catch {
      // PostgreSQL remains authoritative when Redis is unavailable.
    }
    const cacheKey = `network-throttle:v1:policy:${epoch}:${this.hashIp(ip)}:${scope}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached === 'none') return null;
      if (cached) return this.mapControl(JSON.parse(cached) as Record<string, unknown>);
    } catch {
      // Fall through to PostgreSQL.
    }

    try {
      const { data, error } = await this.client().rpc(
        'admin_network_rate_limit_for_ip',
        { p_ip: ip, p_scope: scope },
      );
      if (error) throw error;
      const payload = this.asRecord(data);
      const control = payload.id ? this.mapControl(payload) : null;
      try {
        await redis.set(
          cacheKey,
          control ? JSON.stringify(control) : 'none',
          'EX',
          POLICY_CACHE_SECONDS,
        );
      } catch {
        // Cache writes are best effort.
      }
      return control;
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'admin_network_rate_limit_policy_lookup_failed',
          scope,
          errorType: error instanceof Error ? error.name : 'DatabaseError',
        }),
      );
      return null;
    }
  }

  private async get(id: string): Promise<AdminNetworkRateLimitControl> {
    const { data, error } = await this.client()
      .from('admin_network_rate_limits')
      .select(
        'id, network, scope, max_requests, window_seconds, reason_code, expires_at, created_at, revoked_at',
      )
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Network rate-limit control not found');
    return this.mapControl(data as Record<string, unknown>);
  }

  private async findByIdempotency(
    actorUserId: string,
    idempotencyKey: string,
  ): Promise<AdminNetworkRateLimitControl | null> {
    const { data, error } = await this.client()
      .from('admin_network_rate_limits')
      .select(
        'id, network, scope, max_requests, window_seconds, reason_code, expires_at, created_at, revoked_at',
      )
      .eq('created_by', actorUserId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (error) throw error;
    return data ? this.mapControl(data as Record<string, unknown>) : null;
  }

  private mapControl(row: Record<string, unknown>): AdminNetworkRateLimitControl {
    const maxRequests = this.safeCount(row.max_requests ?? row.maxRequests);
    const windowSeconds = this.safeCount(
      row.window_seconds ?? row.windowSeconds,
    );
    if (maxRequests < 1 || windowSeconds < 1) {
      throw new BadRequestException('Invalid network rate-limit control');
    }
    return {
      id: String(row.id),
      network: String(row.network),
      scope: this.toScope(row.scope),
      maxRequests,
      windowSeconds,
      reasonCode: String(row.reason_code ?? row.reasonCode ?? ''),
      expiresAt: String(row.expires_at ?? row.expiresAt),
      createdAt: String(row.created_at ?? row.createdAt ?? ''),
      revokedAt:
        typeof (row.revoked_at ?? row.revokedAt) === 'string'
          ? String(row.revoked_at ?? row.revokedAt)
          : null,
    };
  }

  private validateExpiry(value: string): string {
    const timestamp = Date.parse(value);
    const duration = timestamp - Date.now();
    if (
      !Number.isFinite(timestamp) ||
      duration < MIN_CONTROL_DURATION_MS ||
      duration > MAX_CONTROL_DURATION_MS
    ) {
      throw new BadRequestException(
        'Emergency throttles must expire between 5 minutes and 24 hours from now',
      );
    }
    return new Date(timestamp).toISOString();
  }

  private bucket(windowSeconds: number): number {
    return Math.floor(Date.now() / 1000 / windowSeconds);
  }

  private secondsUntilNextBucket(windowSeconds: number): number {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return Math.max(windowSeconds - (nowSeconds % windowSeconds), 1);
  }

  private counterKey(
    control: AdminNetworkRateLimitControl,
    ip: string,
    bucket: number,
  ): string {
    return `network-throttle:v1:count:${control.id}:${this.hashIp(ip)}:${bucket}`;
  }

  private hashIp(ip: string): string {
    return createHash('sha256').update(ip).digest('hex').slice(0, 24);
  }

  private coarseNetwork(ip: string): string {
    if (ip.includes(':')) return `${ip.split(':').slice(0, 4).join(':')}::/64`;
    return `${ip.split('.').slice(0, 3).join('.')}.0/24`;
  }

  private safeCount(value: unknown): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= 0
      ? Math.trunc(numberValue)
      : 0;
  }

  private toScope(value: unknown): AdminNetworkBlockScope {
    return value === 'auth' || value === 'write' ? value : 'all';
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }

  private client(): SupabaseClient {
    return this.supabaseService.getClient();
  }

  private async invalidatePolicyCache(): Promise<void> {
    try {
      await this.supabaseService.getRedisClient().incr(POLICY_CACHE_EPOCH_KEY);
    } catch {
      // Cached policies expire after 30 seconds, so invalidation is best effort.
    }
  }
}
