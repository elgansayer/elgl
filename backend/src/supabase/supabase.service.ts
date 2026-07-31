import { Global, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

@Global()
@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient<any, any, any>;
  private readonly redisClient: Redis;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
      );
    }
    this.client = createClient(supabaseUrl, supabaseKey);

    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    this.redisClient.on('error', (err) => {
      console.error('Redis connection error in SupabaseService:', err.message);
    });
  }

  getClient(): SupabaseClient<any, any, any> {
    return this.client;
  }

  getRedisClient(): Redis {
    return this.redisClient;
  }

  async updateLastActivity(userId: string): Promise<void> {
    const supabase = this.getClient();
    // Fetch current study_streak_days and correction_ratio to compute is_serious_learner
    const { data, error: fetchError } = await supabase
      .from('users')
      .select('study_streak_days, correction_ratio')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error(
        `Failed to fetch user data for userId ${userId}:`,
        fetchError.message,
      );
      return;
    }

    const isSeriousLearner =
      (data?.study_streak_days ?? 0) > 7 &&
      (data?.correction_ratio ?? 0) >= 0.8;

    const { error: updateError } = await supabase
      .from('users')
      .update({
        last_active_at: new Date().toISOString(),
        is_serious_learner: isSeriousLearner,
      })
      .eq('id', userId);

    if (updateError) {
      console.error(
        `Failed to update last_active_at for user ${userId}:`,
        updateError.message,
      );
    }
  }

  async incrementXp(userId: string, points: number): Promise<void> {
    const supabase = this.getClient();
    const { error } = await supabase.rpc('increment_xp', {
      user_id: userId,
      amount: points,
    });
    if (error) {
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('xp_total')
        .eq('id', userId)
        .single();
      if (fetchError || !data) {
        console.error(
          `Failed to increment XP for user ${userId}:`,
          error.message ?? fetchError?.message,
        );
        return;
      }
      const current = (data.xp_total ?? 0) + points;
      await supabase
        .from('users')
        .update({ xp_total: current })
        .eq('id', userId);
    }
  }

  async getUserXp(userId: string): Promise<number> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('users')
      .select('xp_total')
      .eq('id', userId)
      .single();
    if (error || !data) {
      return 0;
    }
    return (data.xp_total ?? 0) as number;
  }
}
