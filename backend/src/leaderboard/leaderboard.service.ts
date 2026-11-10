import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface Corrector {
  id: string;
  display_name: string | null | undefined;
  avatar_url: string | null | undefined;
  correction_ratio: number | null | undefined;
  study_streak_days: number | null | undefined;
  is_serious_learner: boolean;
}

export interface WeeklyLeaderboardEntry {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  score: number;
}

export interface WeeklyLeaderboard {
  correctors: WeeklyLeaderboardEntry[];
  study_hours: WeeklyLeaderboardEntry[];
}

const DEFAULT_WEEKLY_LIMIT = 20;
const MAX_WEEKLY_LIMIT = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseWeeklyEntry(
  row: unknown,
): { category: string; entry: WeeklyLeaderboardEntry } | null {
  if (!isRecord(row)) return null;

  const {
    category,
    user_id: userId,
    display_name: displayName,
    avatar_url: avatarUrl,
    score,
  } = row;

  if (typeof category !== 'string' || typeof userId !== 'string') return null;
  if (displayName !== null && typeof displayName !== 'string') return null;
  if (avatarUrl !== null && typeof avatarUrl !== 'string') return null;

  const numericScore =
    typeof score === 'number'
      ? score
      : typeof score === 'string' && score.trim() !== ''
        ? Number(score)
        : Number.NaN;

  if (!Number.isFinite(numericScore) || numericScore < 0) return null;

  return {
    category,
    entry: {
      user_id: userId,
      display_name: displayName ?? null,
      avatar_url: avatarUrl ?? null,
      score: numericScore,
    },
  };
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
        (user.study_streak_days ?? 0) > 7 &&
        (user.correction_ratio ?? 0) >= 0.8,
    }));
  }

  async getWeeklyLeaderboard(
    limit: number = DEFAULT_WEEKLY_LIMIT,
  ): Promise<WeeklyLeaderboard> {
    const safeLimit =
      Number.isSafeInteger(limit) && limit >= 1
        ? Math.min(limit, MAX_WEEKLY_LIMIT)
        : DEFAULT_WEEKLY_LIMIT;

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.rpc('get_weekly_leaderboard', {
      p_limit: safeLimit,
    });

    if (error) {
      throw new Error(`Failed to fetch weekly leaderboard: ${error.message}`);
    }

    if (!Array.isArray(data)) {
      throw new Error('Failed to fetch weekly leaderboard: invalid result');
    }

    const result: WeeklyLeaderboard = { correctors: [], study_hours: [] };

    for (const row of data) {
      const parsed = parseWeeklyEntry(row);
      if (!parsed) {
        throw new Error('Failed to fetch weekly leaderboard: invalid result');
      }

      if (parsed.category === 'correctors') {
        result.correctors.push(parsed.entry);
      } else if (parsed.category === 'study_hours') {
        result.study_hours.push(parsed.entry);
      }
    }

    return result;
  }
}
