import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminUserSummary } from './interfaces/admin-user.interface';

const SUMMARY_COLUMNS =
  'id, display_name, avatar_url, native_languages, target_languages, is_vip, vip_tier, is_admin, coins_balance, study_streak_days, last_active_at, created_at';

@Injectable()
export class AdminUserDetailService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getUser(userId: string): Promise<AdminUserSummary> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select(SUMMARY_COLUMNS)
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('User not found');
    }

    return data;
  }
}
