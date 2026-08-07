import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateEscrowDto,
  ReleaseEscrowDto,
  EscrowListQueryDto,
} from './dto/escrow.dto';
import {
  EscrowPayment,
  EscrowPaymentListResult,
  EscrowStatus,
} from './interfaces/escrow.interface';

/**
 * Redis cache key prefixes and TTLs for escrow payments.
 *
 * Invalidation strategy:
 *  - Individual escrow detail:  cached for 5 minutes, invalidated on mutation
 *  - User-scoped escrow lists:  cached for 60 seconds to stay fresh while
 *    reducing DB pressure; invalidated on any write affecting that user
 *
 * Every mutation (create / release / refund / cancel / dispute) triggers
 * targeted invalidation for the payer, payee, and individual record keys.
 */
const CACHE_PREFIX_USER_LIST = 'escrow:user:list:';
const CACHE_PREFIX_DETAIL = 'escrow:detail:';
const CACHE_TTL_DETAIL = 300; // 5 minutes
const CACHE_TTL_USER_LIST = 60; // 1 minute

const DEFAULT_HOLD_DAYS = 7;

function isEscrowRow(value: unknown): value is EscrowPayment {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.payer_id === 'string' &&
    typeof r.payee_id === 'string' &&
    typeof r.amount_coins === 'number' &&
    typeof r.status === 'string' &&
    typeof r.reference_type === 'string' &&
    typeof r.reference_id === 'string' &&
    typeof r.held_at === 'string' &&
    typeof r.created_at === 'string'
  );
}

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private getRedis(): Redis {
    return this.supabaseService.getRedisClient();
  }

  // ─── Cache Invalidation Rules ──────────────────────────────────────

  /**
   * Invalidates all cached queries that include escrow data for the given
   * user (both as payer and payee) AND the individual escrow detail key.
   *
   * This is the central invalidation point called after every write.
   * By invalidating user-level list caches we ensure the user always sees
   * up-to-date data on their next request, while the individual detail key
   * ensures no stale reads on direct escrow lookups.
   */
  private async invalidateEscrowCaches(
    userIds: string[],
    escrowId?: string,
  ): Promise<void> {
    try {
      const redis = this.getRedis();
      const keysToDelete: string[] = [];

      for (const uid of userIds) {
        const userKeys = await redis.keys(`${CACHE_PREFIX_USER_LIST}${uid}:*`);
        keysToDelete.push(...userKeys);
      }

      if (escrowId) {
        keysToDelete.push(`${CACHE_PREFIX_DETAIL}${escrowId}`);
      }

      if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete);
        this.logger.log(
          `Invalidated ${keysToDelete.length} escrow cache key(s) for users [${userIds.join(', ')}]`,
        );
      }
    } catch (err) {
      this.logger.error('Failed to invalidate escrow caches', err);
    }
  }

  // ─── Public API ────────────────────────────────────────────────────

  /**
   * Creates a new escrow payment, withholding `amount_coins` from the
   * payer's balance and holding them until the payee releases / refunds /
   * cancels, or the hold period expires.
   */
  async createEscrow(
    payerId: string,
    dto: CreateEscrowDto,
  ): Promise<EscrowPayment> {
    if (payerId === dto.payee_id) {
      throw new BadRequestException('Cannot create escrow with yourself');
    }

    const supabase = this.supabaseService.getClient();

    // Verify payer has sufficient balance
    const { data: payerData, error: payerError } = await supabase
      .from('users')
      .select('coins_balance')
      .eq('id', payerId)
      .single();

    if (payerError || !payerData) {
      throw new NotFoundException('Payer not found');
    }

    const currentBalance = Number(payerData.coins_balance ?? 0);
    if (currentBalance < dto.amount_coins) {
      throw new BadRequestException(
        `Insufficient coin balance (${currentBalance} available, ${dto.amount_coins} required)`,
      );
    }

    // Verify payee exists
    const { data: payeeData, error: payeeError } = await supabase
      .from('users')
      .select('id')
      .eq('id', dto.payee_id)
      .single();

    if (payeeError || !payeeData) {
      throw new NotFoundException('Payee not found');
    }

    // Deduct coins from payer
    const newBalance = currentBalance - dto.amount_coins;
    const { error: balanceError } = await supabase
      .from('users')
      .update({ coins_balance: newBalance })
      .eq('id', payerId);

    if (balanceError) {
      throw new BadRequestException('Failed to deduct coins from balance');
    }

    // Create escrow record
    const now = new Date().toISOString();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DEFAULT_HOLD_DAYS);

    const escrowInsert = {
      payer_id: payerId,
      payee_id: dto.payee_id,
      amount_coins: dto.amount_coins,
      status: EscrowStatus.HELD,
      reference_type: dto.reference_type,
      reference_id: dto.reference_id,
      held_at: now,
      expires_at: expiresAt.toISOString(),
      metadata: dto.metadata ? JSON.parse(dto.metadata) : null,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('escrow_payments')
      .insert(escrowInsert)
      .select('*')
      .single();

    if (insertError || !inserted) {
      // Rollback coin deduction
      await supabase
        .from('users')
        .update({ coins_balance: currentBalance })
        .eq('id', payerId);
      throw new BadRequestException('Failed to create escrow payment');
    }

    if (!isEscrowRow(inserted)) {
      throw new BadRequestException('Invalid escrow data returned');
    }

    // Invalidate caches for both payer and payee
    await this.invalidateEscrowCaches([payerId, dto.payee_id], inserted.id);

    return inserted;
  }

  /**
   * Releases (pays out to payee), refunds (returns to payer), or cancels
   * a held escrow.  Only the payee may release; only the payer may refund
   * or cancel.
   */
  async resolveEscrow(
    escrowId: string,
    actingUserId: string,
    dto: ReleaseEscrowDto,
  ): Promise<EscrowPayment> {
    const supabase = this.supabaseService.getClient();

    const escrow = await this.getEscrowByIdInternal(escrowId);
    if (!escrow) {
      throw new NotFoundException(`Escrow ${escrowId} not found`);
    }

    if (escrow.status !== EscrowStatus.HELD) {
      throw new ConflictException(
        `Escrow ${escrowId} is already ${escrow.status}`,
      );
    }

    const now = new Date().toISOString();
    let newStatus: EscrowStatus;
    let recipientId: string;
    // Coins to credit to whoever should receive them
    let creditUserId: string | null = null;

    switch (dto.action) {
      case 'release': {
        if (actingUserId !== escrow.payee_id) {
          throw new BadRequestException('Only the payee may release escrow');
        }
        newStatus = EscrowStatus.RELEASED;
        creditUserId = escrow.payee_id;
        break;
      }
      case 'refund': {
        if (
          actingUserId !== escrow.payee_id &&
          actingUserId !== escrow.payer_id
        ) {
          throw new BadRequestException(
            'Only the payer or payee may request a refund',
          );
        }
        newStatus = EscrowStatus.REFUNDED;
        creditUserId = escrow.payer_id;
        break;
      }
      case 'cancel': {
        if (actingUserId !== escrow.payer_id) {
          throw new BadRequestException('Only the payer may cancel escrow');
        }
        newStatus = EscrowStatus.CANCELLED;
        creditUserId = escrow.payer_id;
        break;
      }
      default:
        throw new BadRequestException(`Unknown action: ${dto.action}`);
    }

    if (creditUserId) {
      // Fetch current balance and increment
      const { data: balanceRow } = await supabase
        .from('users')
        .select('coins_balance')
        .eq('id', creditUserId)
        .single();

      const currentRecipientBalance = Number(balanceRow?.coins_balance ?? 0);
      const newRecipientBalance = currentRecipientBalance + escrow.amount_coins;

      const { error: creditError } = await supabase
        .from('users')
        .update({ coins_balance: newRecipientBalance })
        .eq('id', creditUserId);

      if (creditError) {
        throw new BadRequestException('Failed to credit coins');
      }
    }

    // Update escrow status
    const nowISO = new Date().toISOString();
    const updatePayload: {
      status: string;
      updated_at: string;
      released_at?: string | null;
      refunded_at?: string | null;
      cancelled_at?: string | null;
    } = {
      status: newStatus,
      updated_at: nowISO,
    };
    if (newStatus === EscrowStatus.RELEASED) {
      updatePayload.released_at = nowISO;
    }
    if (newStatus === EscrowStatus.REFUNDED) {
      updatePayload.refunded_at = nowISO;
    }
    if (newStatus === EscrowStatus.CANCELLED) {
      updatePayload.cancelled_at = nowISO;
    }

    const { data: updated, error: updateError } = await supabase
      .from('escrow_payments')
      .update(updatePayload)
      .eq('id', escrowId)
      .select('*')
      .single();

    if (updateError || !updated) {
      throw new BadRequestException('Failed to update escrow status');
    }

    if (!isEscrowRow(updated)) {
      throw new BadRequestException('Invalid escrow data returned');
    }

    // Invalidate caches for both parties
    await this.invalidateEscrowCaches(
      [escrow.payer_id, escrow.payee_id],
      escrowId,
    );

    return updated;
  }

  /**
   * Fetches a single escrow by ID, with Redis read-through caching.
   */
  async getEscrowById(escrowId: string): Promise<EscrowPayment> {
    const cacheKey = `${CACHE_PREFIX_DETAIL}${escrowId}`;

    try {
      const redis = this.getRedis();
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed: unknown = JSON.parse(cached);
        if (isEscrowRow(parsed)) {
          return parsed;
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to read escrow cache for ${escrowId}`, err);
    }

    const escrow = await this.getEscrowByIdInternal(escrowId);
    if (!escrow) {
      throw new NotFoundException(`Escrow ${escrowId} not found`);
    }

    try {
      const redis = this.getRedis();
      await redis.set(cacheKey, JSON.stringify(escrow), 'EX', CACHE_TTL_DETAIL);
    } catch (err) {
      this.logger.warn(`Failed to cache escrow ${escrowId}`, err);
    }

    return escrow;
  }

  /**
   * Lists escrow payments for a user (as payer or payee), with Redis
   * read-through caching and TTL-based freshness.
   */
  async listEscrows(
    userId: string,
    query: EscrowListQueryDto,
  ): Promise<EscrowPaymentListResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const role = query.role ?? 'payer';
    const status = query.status ?? '';

    const cacheKey = `${CACHE_PREFIX_USER_LIST}${userId}:${role}:${status}:${page}:${pageSize}`;

    try {
      const redis = this.getRedis();
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed: unknown = JSON.parse(cached);
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          'payments' in parsed &&
          'total' in parsed
        ) {
          return parsed as EscrowPaymentListResult;
        }
      }
    } catch (err) {
      this.logger.warn(
        `Failed to read escrow list cache for user ${userId}`,
        err,
      );
    }

    const supabase = this.supabaseService.getClient();
    const column = role === 'payer' ? 'payer_id' : 'payee_id';
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let request = supabase
      .from('escrow_payments')
      .select('*', { count: 'exact' })
      .eq(column, userId);

    if (status) {
      request = request.eq('status', status);
    }

    const { data, error, count } = await request
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      this.logger.warn(
        `Failed to fetch escrow list for user ${userId}: ${error.message}`,
      );
      return { payments: [], total: 0, page, pageSize };
    }

    const payments: EscrowPayment[] = (data ?? []).filter(
      (row): row is EscrowPayment => isEscrowRow(row),
    );

    const result: EscrowPaymentListResult = {
      payments,
      total: count ?? 0,
      page,
      pageSize,
    };

    try {
      const redis = this.getRedis();
      await redis.set(
        cacheKey,
        JSON.stringify(result),
        'EX',
        CACHE_TTL_USER_LIST,
      );
    } catch (err) {
      this.logger.warn(`Failed to cache escrow list for user ${userId}`, err);
    }

    return result;
  }

  // ─── Internal Helpers ──────────────────────────────────────────────

  private async getEscrowByIdInternal(
    escrowId: string,
  ): Promise<EscrowPayment | null> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('escrow_payments')
      .select('*')
      .eq('id', escrowId)
      .single();

    if (error || !data) {
      return null;
    }

    if (!isEscrowRow(data)) {
      return null;
    }

    return data;
  }
}
