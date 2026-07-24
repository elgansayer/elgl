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
        'id, display_name, avatar_url, correction_ratio, study_streak_days, is_serious_learner',
      )
      .order('correction_ratio', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch top correctors: ${error.message}`);
    }

    return data ?? [];
  }
}
