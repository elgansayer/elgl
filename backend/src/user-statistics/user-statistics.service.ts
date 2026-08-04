import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UserStatisticsQueryDto } from './dto/user-statistics-query.dto';

type SupabaseClient = ReturnType<SupabaseService['getClient']>;

@Injectable()
export class UserStatisticsService {
  private readonly supabase: SupabaseClient;

  constructor(private readonly supabaseService: SupabaseService) {
    this.supabase = this.supabaseService.getClient();
  }

  async getUserStatistics(userId: string, query?: UserStatisticsQueryDto) {
    const { data: user, error: userError } = await this.supabase
      .from('users')
      .select(
        'study_streak_days, correction_ratio, coins_balance, created_at, is_vip',
      )
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new NotFoundException('User not found');
    }

    const studyStreakDays = user.study_streak_days ?? 0;
    const correctionRatio = user.correction_ratio ?? 0;
    const coinsBalance = user.coins_balance ?? 0;
    const isVip = user.is_vip ?? false;

    // Moment posts
    let momentQuery = this.supabase
      .from('moments')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', userId);
    if (query?.fromDate) {
      momentQuery = momentQuery.gte('created_at', query.fromDate);
    }
    if (query?.toDate) {
      momentQuery = momentQuery.lte('created_at', query.toDate);
    }
    const { count: totalMoments } = await momentQuery;

    // Comments authored
    let commentQuery = this.supabase
      .from('moment_comments')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', userId);
    if (query?.fromDate) {
      commentQuery = commentQuery.gte('created_at', query.fromDate);
    }
    if (query?.toDate) {
      commentQuery = commentQuery.lte('created_at', query.toDate);
    }
    const { count: totalComments } = await commentQuery;

    // Likes received on user's moments
    let momentIdsQuery = this.supabase
      .from('moments')
      .select('id')
      .eq('author_id', userId);
    if (query?.fromDate) {
      momentIdsQuery = momentIdsQuery.gte('created_at', query.fromDate);
    }
    if (query?.toDate) {
      momentIdsQuery = momentIdsQuery.lte('created_at', query.toDate);
    }
    const { data: momentIds, error: momentIdsError } = await momentIdsQuery;
    if (momentIdsError) {
      throw new NotFoundException('Could not load moments');
    }
    const ids = momentIds?.map((m: { id: string }) => m.id) ?? [];

    let likesReceived = 0;
    if (ids.length > 0) {
      const { count: totalLikes } = await this.supabase
        .from('moment_likes')
        .select('id', { count: 'exact', head: true })
        .in('moment_id', ids);
      likesReceived = totalLikes ?? 0;
    }

    // Profile visits
    let visitQuery = this.supabase
      .from('profile_visits')
      .select('id', { count: 'exact', head: true })
      .eq('viewed_id', userId);
    if (query?.fromDate) {
      visitQuery = visitQuery.gte('created_at', query.fromDate);
    }
    if (query?.toDate) {
      visitQuery = visitQuery.lte('created_at', query.toDate);
    }
    const { count: totalProfileVisits } = await visitQuery;

    return {
      studyStreakDays,
      correctionRatio,
      coinsBalance,
      isVip,
      accountCreatedAt: user.created_at,
      totalMoments: totalMoments ?? 0,
      totalComments: totalComments ?? 0,
      totalLikesReceived: likesReceived,
      totalProfileVisits: totalProfileVisits ?? 0,
    };
  }
}
