import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface BlockedRow {
  blocked_id: string;
}

export interface BlockedUser {
  id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  native_language: string | null;
  target_languages: string[] | null;
}

@Injectable()
export class BlocksService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getBlockedUsers(requestUserId: string): Promise<BlockedUser[]> {
    const client = this.supabaseService.getClient();

    const { data: blockedRows, error: blockError } = await client
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', requestUserId);

    if (blockError) {
      throw new Error(`Failed to fetch blocked users: ${blockError.message}`);
    }

    const blockedIds: string[] = (blockedRows as BlockedRow[]).map(
      (row) => row.blocked_id,
    );

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

    return (users as BlockedUser[]) ?? [];
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

    return { success: true };
  }
}
