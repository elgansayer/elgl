import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';

interface LanguageChallengeRow {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  entry_fee_coins: number;
  duration_days: number;
  challenge_type: 'streak' | 'points';
  prize_pool_coins: number;
  status: 'open' | 'completed' | 'cancelled';
  starts_at: string;
  ends_at: string;
  completed_at: string | null;
  created_at: string;
}

interface ChallengeParticipantRow {
  challenge_id: string;
  status: 'active' | 'completed' | 'failed';
  prize_coins: number;
}

interface ChallengeActivityRow {
  challenge_id: string;
  activity_date: string;
}

export interface LanguageChallengeSummary extends LanguageChallengeRow {
  joined: boolean;
  participant_status: ChallengeParticipantRow['status'] | null;
  progress_days: number;
  prize_coins: number;
  ended: boolean;
}

interface JoinResult {
  joined: boolean;
  alreadyJoined: boolean;
  coinsRemaining: number;
  prizePoolCoins: number;
}

interface CheckinResult {
  checkedIn: boolean;
  alreadyCheckedIn: boolean;
  progressDays: number;
  targetDays: number;
  activityDate: string;
}

interface ClaimResult {
  claimed: boolean;
  alreadySettled: boolean;
  prizeCoins: number;
  winnerCount?: number;
  remainderCoins?: number;
}

interface SupabaseRpcError {
  code?: string;
  message?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class LanguageChallengesService {
  private readonly logger = new Logger(LanguageChallengesService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase(): SupabaseClient {
    return this.supabaseService.getClient();
  }

  async createChallenge(
    creatorId: string,
    dto: CreateChallengeDto,
  ): Promise<LanguageChallengeSummary> {
    const startsAt = new Date();
    const endsAt = new Date(
      startsAt.getTime() + dto.durationDays * 24 * 60 * 60 * 1000,
    );

    const { data, error } = await this.supabase
      .from('language_challenges')
      .insert({
        creator_id: creatorId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        entry_fee_coins: dto.entryFeeCoins,
        duration_days: dto.durationDays,
        challenge_type: dto.challengeType ?? 'streak',
        prize_pool_coins: 0,
        status: 'open',
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      .select(
        'id, creator_id, title, description, entry_fee_coins, duration_days, challenge_type, prize_pool_coins, status, starts_at, ends_at, completed_at, created_at',
      )
      .single<LanguageChallengeRow>();

    if (error || !data) {
      this.logger.error(
        `Challenge creation failed (${error?.code ?? 'missing_result'})`,
      );
      throw new ServiceUnavailableException('Could not create challenge');
    }

    return this.toSummary(data, null, 0);
  }

  async listChallenges(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<LanguageChallengeSummary[]> {
    const boundedLimit = Math.max(1, Math.min(50, limit));
    const boundedOffset = Math.max(0, Math.min(10_000, offset));

    const { data: challenges, error } = await this.supabase
      .from('language_challenges')
      .select(
        'id, creator_id, title, description, entry_fee_coins, duration_days, challenge_type, prize_pool_coins, status, starts_at, ends_at, completed_at, created_at',
      )
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .range(boundedOffset, boundedOffset + boundedLimit - 1)
      .returns<LanguageChallengeRow[]>();

    if (error) {
      this.logger.error(`Challenge list failed (${error.code ?? 'unknown'})`);
      throw new ServiceUnavailableException(
        'Challenges are temporarily unavailable',
      );
    }
    if (!challenges?.length) return [];

    const challengeIds = challenges.map((challenge) => challenge.id);
    const [participantsResult, activityResult] = await Promise.all([
      this.supabase
        .from('language_challenge_participants')
        .select('challenge_id, status, prize_coins')
        .eq('user_id', userId)
        .in('challenge_id', challengeIds)
        .returns<ChallengeParticipantRow[]>(),
      this.supabase
        .from('language_challenge_daily_activity')
        .select('challenge_id, activity_date')
        .eq('user_id', userId)
        .in('challenge_id', challengeIds)
        .returns<ChallengeActivityRow[]>(),
    ]);

    if (participantsResult.error || activityResult.error) {
      this.logger.error('Challenge progress lookup failed');
      throw new ServiceUnavailableException(
        'Challenge progress is temporarily unavailable',
      );
    }

    const participantByChallenge = new Map(
      (participantsResult.data ?? []).map((row) => [row.challenge_id, row]),
    );
    const progressByChallenge = new Map<string, Set<string>>();
    for (const row of activityResult.data ?? []) {
      const dates =
        progressByChallenge.get(row.challenge_id) ?? new Set<string>();
      dates.add(row.activity_date);
      progressByChallenge.set(row.challenge_id, dates);
    }

    return challenges.map((challenge) =>
      this.toSummary(
        challenge,
        participantByChallenge.get(challenge.id) ?? null,
        progressByChallenge.get(challenge.id)?.size ?? 0,
      ),
    );
  }

  async joinChallenge(
    userId: string,
    challengeId: string,
  ): Promise<JoinResult> {
    const { data, error } = await this.supabase.rpc('join_language_challenge', {
      p_challenge_id: challengeId,
      p_user_id: userId,
    });
    if (error) this.throwRpcError('join', error);
    return this.parseJoinResult(data);
  }

  async dailyCheckin(
    userId: string,
    challengeId: string,
  ): Promise<CheckinResult> {
    const { data, error } = await this.supabase.rpc(
      'checkin_language_challenge',
      {
        p_challenge_id: challengeId,
        p_user_id: userId,
      },
    );
    if (error) this.throwRpcError('checkin', error);
    return this.parseCheckinResult(data);
  }

  async claimPrize(userId: string, challengeId: string): Promise<ClaimResult> {
    const { data, error } = await this.supabase.rpc(
      'claim_language_challenge_prize',
      {
        p_challenge_id: challengeId,
        p_user_id: userId,
      },
    );
    if (error) this.throwRpcError('claim', error);
    return this.parseClaimResult(data);
  }

  private toSummary(
    challenge: LanguageChallengeRow,
    participant: ChallengeParticipantRow | null,
    progressDays: number,
  ): LanguageChallengeSummary {
    return {
      ...challenge,
      joined: participant !== null,
      participant_status: participant?.status ?? null,
      progress_days: Math.max(
        0,
        Math.min(progressDays, challenge.duration_days),
      ),
      prize_coins: participant?.prize_coins ?? 0,
      ended: Date.parse(challenge.ends_at) <= Date.now(),
    };
  }

  private throwRpcError(operation: string, error: SupabaseRpcError): never {
    const message = error.message ?? '';
    this.logger.warn(
      `Challenge ${operation} rejected (${error.code ?? 'unknown'})`,
    );

    if (
      message.includes('challenge_not_found') ||
      message.includes('user_not_found')
    ) {
      throw new NotFoundException('Challenge not found');
    }
    if (message.includes('insufficient_coins')) {
      throw new BadRequestException('Not enough coins to join this challenge');
    }
    if (message.includes('challenge_not_joined')) {
      throw new BadRequestException('Join this challenge first');
    }
    if (message.includes('challenge_incomplete')) {
      throw new BadRequestException('Challenge requirements are not complete');
    }
    if (
      message.includes('challenge_not_open') ||
      message.includes('challenge_not_active') ||
      message.includes('challenge_still_running') ||
      message.includes('challenge_no_winners')
    ) {
      throw new ConflictException('Challenge is not available for this action');
    }

    throw new ServiceUnavailableException(
      'Challenge action is temporarily unavailable',
    );
  }

  private parseJoinResult(value: unknown): JoinResult {
    if (
      isRecord(value) &&
      typeof value['joined'] === 'boolean' &&
      typeof value['alreadyJoined'] === 'boolean' &&
      typeof value['coinsRemaining'] === 'number' &&
      typeof value['prizePoolCoins'] === 'number'
    ) {
      return value as unknown as JoinResult;
    }
    throw new ServiceUnavailableException('Invalid challenge join response');
  }

  private parseCheckinResult(value: unknown): CheckinResult {
    if (
      isRecord(value) &&
      typeof value['checkedIn'] === 'boolean' &&
      typeof value['alreadyCheckedIn'] === 'boolean' &&
      typeof value['progressDays'] === 'number' &&
      typeof value['targetDays'] === 'number' &&
      typeof value['activityDate'] === 'string'
    ) {
      return value as unknown as CheckinResult;
    }
    throw new ServiceUnavailableException(
      'Invalid challenge check-in response',
    );
  }

  private parseClaimResult(value: unknown): ClaimResult {
    if (
      isRecord(value) &&
      typeof value['claimed'] === 'boolean' &&
      typeof value['alreadySettled'] === 'boolean' &&
      typeof value['prizeCoins'] === 'number'
    ) {
      return value as unknown as ClaimResult;
    }
    throw new ServiceUnavailableException('Invalid challenge claim response');
  }
}
