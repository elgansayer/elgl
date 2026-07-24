import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class LeaderboardService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getTopCorrectors(limit: number = 20): Promise<any[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, correction_ratio, study_streak_days, is_serious_learner')
      .order('correction_ratio', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch top correctors: ${error.message}`);
    }

    return data ?? [];
  }
}
