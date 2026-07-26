import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async calculateDailyRecommendations() {
    this.logger.log('Starting daily recommendation calculations...');
    const supabase = this.supabaseService.getClient();
    const redis = this.supabaseService.getRedisClient();

    try {
      // Fetch all active users who are visible in search
      const { data: users, error } = await supabase
        .from('users')
        .select('id, native_language, target_languages')
        .eq('privacy_hide_from_search', false);

      if (error || !users) {
        throw new Error(`Failed to fetch users: ${error?.message}`);
      }

      for (const user of users) {
        if (!user.target_languages || user.target_languages.length === 0) continue;

        // Find users who speak the target language natively and are learning the user's native language
        const { data: matches } = await supabase
          .from('users')
          .select('id, is_serious_learner')
          .neq('id', user.id)
          .eq('privacy_hide_from_search', false)
          .in('native_language', user.target_languages)
          .contains('target_languages', [user.native_language])
          .order('is_serious_learner', { ascending: false })
          .limit(10);

        if (matches && matches.length > 0) {
          const recommendedIds = matches.map((m) => m.id);
          
          // Cache the top 10 recommendations in Redis for 24 hours
          await redis.set(
            `recommendations:${user.id}`,
            JSON.stringify(recommendedIds),
            'EX',
            86400, // 24 hours
          );
        }
      }

      this.logger.log('Successfully calculated and cached daily recommendations.');
    } catch (error) {
      this.logger.error('Error calculating recommendations', error);
    }
  }
}
