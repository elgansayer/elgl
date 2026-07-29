import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface Corrector {
  id: string;
  display_name: string;
  avatar_url: string | null;
  correction_ratio: number;
  study_streak_days: number;
  is_serious_learner: boolean;
}

@Injectable()
export class LeaderboardService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getTopCorrectors(limit: number = 20): Promise<Corrector[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('users')
      .select(
        'id, display_name, avatar_url, correction_ratio, study_streak_days',
      )
      .order('correction_ratio', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch top correctors: ${error.message}`);
    }

    return (data ?? []).map((user) => ({
      ...user,
      is_serious_learner:
        user.study_streak_days > 7 && (user.correction_ratio ?? 0) >= 0.8,
    }));
  }
}
