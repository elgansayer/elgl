import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class CorrectorScoreService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async submitRating(
    raterId: string,
    ratedUserId: string,
    score: number,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('corrector_ratings')
      .upsert(
        { rater_id: raterId, rated_user_id: ratedUserId, score },
        { onConflict: 'rater_id,rated_user_id' },
      );
    if (error) throw error;
  }

  async getCorrectorScore(
    userId: string,
  ): Promise<{ averageScore: number | null; totalRatings: number }> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('corrector_ratings')
      .select('score')
      .eq('rated_user_id', userId);
    if (error) throw error;
    const scores = (data ?? []).map((r: any) => r.score);
    const total = scores.length;
    const averageScore =
      total > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / total) * 10) / 10
        : null;
    return { averageScore, totalRatings: total };
  }
}
