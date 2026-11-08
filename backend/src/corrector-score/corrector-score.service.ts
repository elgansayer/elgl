import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface CorrectorScoreResult {
  averageScore: number | null;
  totalRatings: number;
}

@Injectable()
export class CorrectorScoreService {
  private readonly logger = new Logger(CorrectorScoreService.name);

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
    if (error) {
      this.logger.error('Corrector rating persistence failed');
      throw new InternalServerErrorException();
    }
  }

  async getCorrectorScore(userId: string): Promise<CorrectorScoreResult> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.rpc('get_corrector_score', {
      p_user_id: userId,
    });
    const row = data?.[0];

    if (
      error ||
      data?.length !== 1 ||
      !row ||
      !Number.isSafeInteger(row.total_ratings) ||
      row.total_ratings < 0 ||
      (row.average_score !== null &&
        (!Number.isFinite(row.average_score) ||
          row.average_score < 1 ||
          row.average_score > 5))
    ) {
      this.logger.error('Corrector score aggregation failed');
      throw new InternalServerErrorException();
    }

    return {
      averageScore: row.average_score,
      totalRatings: row.total_ratings,
    };
  }
}
