import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from '../metrics/metrics.service';

export interface BlockedUserSummary {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  native_language: string | null;
  target_languages: string[] | null;
}

const MAX_BLOCKS_PAGE_SIZE = 100;

@Injectable()
export class BlocksService {
  private readonly logger = new Logger(BlocksService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly metricsService: MetricsService,
  ) {}

  async getBlockedUsers(
    requestUserId: string,
    limit = MAX_BLOCKS_PAGE_SIZE,
    offset = 0,
  ): Promise<BlockedUserSummary[]> {
    const client = this.supabaseService.getClient();
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || MAX_BLOCKS_PAGE_SIZE, 1), MAX_BLOCKS_PAGE_SIZE);
    const safeOffset = Math.max(Math.trunc(offset) || 0, 0);

    const { data: blockedRows, error: blockError } = await client
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', requestUserId)
      .order('created_at', { ascending: false })
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (blockError) {
      this.logger.warn('Blocked-user list query failed');
      throw new InternalServerErrorException('Unable to load blocked users');
    }

    const blockedIds: string[] = (blockedRows ?? [])
      .map((row: { blocked_id?: unknown }) => row.blocked_id)
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);

    if (blockedIds.length === 0) {
      return [];
    }

    const { data: users, error: userError } = await client
      .from('users')
      .select('id, display_name, avatar_url, native_language, target_languages')
      .in('id', blockedIds);

    if (userError) {
      this.logger.warn('Blocked-user profile query failed');
      throw new InternalServerErrorException('Unable to load blocked users');
    }

    const byId = new Map<string, BlockedUserSummary>();
    for (const row of users ?? []) {
      if (!row || typeof row.id !== 'string') continue;
      byId.set(row.id, row as BlockedUserSummary);
    }

    return blockedIds
      .map((id) => byId.get(id))
      .filter((user): user is BlockedUserSummary => user !== undefined);
  }

  async blockUser(
    blockerId: string,
    blockedId: string,
  ): Promise<{ success: boolean }> {
    if (blockerId === blockedId) {
      return { success: false };
    }

    const client = this.supabaseService.getClient();
    const { error } = await client.from('blocks').upsert(
      { blocker_id: blockerId, blocked_id: blockedId },
      { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
    );

    if (error) {
      this.logger.warn('Block creation failed');
      throw new InternalServerErrorException('Unable to update block state');
    }

    return { success: true };
  }

  async unblockUser(
    blockerId: string,
    blockedId: string,
  ): Promise<{ success: boolean }> {
    const client = this.supabaseService.getClient();

    const { error } = await client
      .from('blocks')
      .delete()
      .match({ blocker_id: blockerId, blocked_id: blockedId });

    if (error) {
      this.logger.warn('Block removal failed');
      throw new InternalServerErrorException('Unable to update block state');
    }

    this.metricsService.recordTsBlockRemoved();
    return { success: true };
  }
}
