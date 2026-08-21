import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class BlocksService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly metricsService: MetricsService,
  ) {}

  async getBlockedUsers(requestUserId: string): Promise<any[]> {
    const client = this.supabaseService.getClient();

    const { data: blockedRows, error: blockError } = await client
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', requestUserId);

    if (blockError) {
      throw new Error(`Failed to fetch blocked users: ${blockError.message}`);
    }

    const blockedIds: string[] = blockedRows.map((row: any) => row.blocked_id);

    if (blockedIds.length === 0) {
      return [];
    }

    const { data: users, error: userError } = await client
      .from('users')
      .select('id, display_name, avatar_url, native_language, target_languages')
      .in('id', blockedIds);

    if (userError) {
      throw new Error(`Failed to fetch user details: ${userError.message}`);
    }

    return users ?? [];
  }

  async blockUser(
    blockerId: string,
    blockedId: string,
  ): Promise<{ success: boolean }> {
    const client = this.supabaseService.getClient();

    const { error } = await client
      .from('blocks')
      .insert({ blocker_id: blockerId, blocked_id: blockedId });

    if (error) {
      throw new Error(`Failed to block user: ${error.message}`);
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
      throw new Error(`Failed to unblock user: ${error.message}`);
    }

    this.metricsService.recordTsBlockRemoved();

    return { success: true };
  }
}
