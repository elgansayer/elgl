import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { randomUUID as uuidv4 } from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { MonetisationService } from '../monetisation/monetisation.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';

type LanguageChallenge = {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  entry_fee_coins: number;
  duration_days: number;
  challenge_type: string;
  prize_pool_coins: number;
  status: 'open' | 'closed' | 'completed';
  created_at: string;
};

type ChallengeParticipant = {
  user_id: string;
};

type DailyActivity = {
  activity_date: string;
};

@Injectable()
export class LanguageChallengesService {
  private readonly logger = new Logger(LanguageChallengesService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly monetisationService: MonetisationService,
  ) {}

  private get supabase(): SupabaseClient {
    return this.supabaseService.getClient();
  }

  async createChallenge(creatorId: string, dto: CreateChallengeDto) {
    const supabase = this.supabase;
    const challengeId = uuidv4();

    const { error } = await supabase.from('language_challenges').insert({
      id: challengeId,
      creator_id: creatorId,
      title: dto.title,
      description: dto.description,
      entry_fee_coins: dto.entryFeeCoins,
      duration_days: dto.durationDays,
      challenge_type: dto.challengeType ?? 'streak',
      prize_pool_coins: 0,
      status: 'open',
    });

    if (error) {
      this.logger.error(`Failed to create challenge: ${error.message}`);
      throw new BadRequestException('Could not create challenge');
    }

    this.logger.log(`Challenge ${challengeId} created by user ${creatorId}`);
    return { challengeId };
  }

  async listChallenges() {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('language_challenges')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .returns<LanguageChallenge[]>();

    if (error) {
      this.logger.error(`Failed to list challenges: ${error.message}`);
      return [];
    }
    return data;
  }

  async joinChallenge(userId: string, challengeId: string) {
    const supabase = this.supabase;

    // fetch challenge
    const { data: challenge, error: fetchError } = await supabase
      .from('language_challenges')
      .select('*')
      .eq('id', challengeId)
      .returns<LanguageChallenge[]>()
      .single();

    if (fetchError || !challenge) {
      throw new NotFoundException('Challenge not found');
    }

    if (challenge.status !== 'open') {
      throw new BadRequestException('Challenge is not open for joining');
    }

    // ensure not already a participant
    const { data: existing } = await supabase
      .from('language_challenge_participants')
      .select('id')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('You have already joined this challenge');
    }

    // deduct entry fee
    await this.monetisationService.deductCoins(
      userId,
      challenge.entry_fee_coins,
    );

    // update prize pool
    const newPrizePool =
      (challenge.prize_pool_coins ?? 0) + challenge.entry_fee_coins;
    await supabase
      .from('language_challenges')
      .update({ prize_pool_coins: newPrizePool })
      .eq('id', challengeId);

    // record participant
    await supabase.from('language_challenge_participants').insert({
      challenge_id: challengeId,
      user_id: userId,
      status: 'active',
    });

    this.logger.log(
      `User ${userId} joined challenge ${challengeId}, paid ${challenge.entry_fee_coins} coins`,
    );
    return { joined: true };
  }

  async dailyCheckin(
    userId: string,
    challengeId: string,
  ): Promise<{ checkedIn: boolean }> {
    const supabase = this.supabase;

    // ensure challenge exists and is active
    const { data: challenge, error: fetchError } = await supabase
      .from('language_challenges')
      .select('*')
      .eq('id', challengeId)
      .returns<LanguageChallenge[]>()
      .single();
    if (fetchError || !challenge) {
      throw new NotFoundException('Challenge not found');
    }
    if (challenge.status !== 'open') {
      throw new BadRequestException('Challenge is not active');
    }

    // verify user is a participant
    const { data: participant } = await supabase
      .from('language_challenge_participants')
      .select('id')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!participant) {
      throw new BadRequestException('You have not joined this challenge');
    }

    const today = new Date().toISOString().split('T')[0];

    // prevent duplicate checkins for the same day
    const { data: existing } = await supabase
      .from('language_challenge_daily_activity')
      .select('id')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .eq('activity_date', today)
      .maybeSingle();
    if (existing) {
      throw new BadRequestException('Already checked in today');
    }

    const { error: insertError } = await supabase
      .from('language_challenge_daily_activity')
      .insert({
        challenge_id: challengeId,
        user_id: userId,
        activity_date: today,
      });
    if (insertError) {
      this.logger.error(`Daily checkin insert failed: ${insertError.message}`);
      throw new BadRequestException('Failed to record daily checkin');
    }

    this.logger.log(
      `User ${userId} checked in for challenge ${challengeId} on ${today}`,
    );
    return { checkedIn: true };
  }

  async claimPrize(userId: string, challengeId: string) {
    const supabase = this.supabase;

    // fetch challenge
    const { data: challenge, error: fetchError } = await supabase
      .from('language_challenges')
      .select('*')
      .eq('id', challengeId)
      .returns<LanguageChallenge[]>()
      .single();

    if (fetchError || !challenge) {
      throw new NotFoundException('Challenge not found');
    }

    if (challenge.status !== 'open') {
      throw new BadRequestException('Challenge has already ended');
    }

    // check if duration has passed
    const createdAt = new Date(challenge.created_at).getTime();
    const durationMs = challenge.duration_days * 24 * 60 * 60 * 1000;
    const deadline = new Date(createdAt + durationMs).getTime();
    const now = Date.now();

    if (now < deadline) {
      throw new BadRequestException('Challenge is still running');
    }

    // verify user is a participant
    const { data: participant } = await supabase
      .from('language_challenge_participants')
      .select('id')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!participant) {
      throw new BadRequestException('You did not join this challenge');
    }

    // compute distinct checkin dates for this participant
    const { data: activityRows, error: actError } = await supabase
      .from('language_challenge_daily_activity')
      .select('activity_date')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .returns<DailyActivity[]>();

    if (actError) {
      this.logger.error(
        `Failed to retrieve daily activity: ${actError.message}`,
      );
      throw new BadRequestException('Failed to retrieve daily activity');
    }

    const uniqueDays = new Set(activityRows?.map((r) => r.activity_date) ?? []);

    // check participant met daily requirement (at least durationDays distinct days)
    if (uniqueDays.size < challenge.duration_days) {
      throw new BadRequestException(
        `You need at least ${challenge.duration_days} daily checkins to complete this challenge. You have ${uniqueDays.size}.`,
      );
    }

    // find all participants who also met the requirement
    const { data: allParticipants } = await supabase
      .from('language_challenge_participants')
      .select('user_id')
      .eq('challenge_id', challengeId)
      .returns<ChallengeParticipant[]>();

    const completerIds: string[] = [];

    if (allParticipants && allParticipants.length > 0) {
      const participantIds = allParticipants.map((p) => p.user_id);

      const { data: allActs } = await supabase
        .from('language_challenge_daily_activity')
        .select('user_id, activity_date')
        .eq('challenge_id', challengeId)
        .in('user_id', participantIds)
        .returns<(DailyActivity & { user_id: string })[]>();

      const userDays = new Map<string, Set<string>>();

      for (const act of allActs ?? []) {
        if (!userDays.has(act.user_id)) {
          userDays.set(act.user_id, new Set());
        }
        userDays.get(act.user_id)!.add(act.activity_date);
      }

      for (const pId of participantIds) {
        const uDays = userDays.get(pId) ?? new Set();
        if (uDays.size >= challenge.duration_days) {
          completerIds.push(pId);
        }
      }
    }

    if (completerIds.length === 0) {
      throw new BadRequestException('No participants completed the challenge');
    }

    const prizePool = challenge.prize_pool_coins ?? 0;
    const share = Math.floor(prizePool / completerIds.length);

    // award coins to each completer concurrently
    // ⚡ Bolt: Optimize monetisation payouts via Promise.allSettled
    const payoutResults = await Promise.allSettled(
      completerIds.map((cid) => this.monetisationService.addCoins(cid, share)),
    );
    const failedPayouts = payoutResults.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failedPayouts.length > 0) {
      throw failedPayouts[0].reason;
    }

    // mark challenge as completed, leave remaining prize in pool
    await supabase
      .from('language_challenges')
      .update({
        status: 'completed',
        prize_pool_coins: prizePool - share * completerIds.length,
      })
      .eq('id', challengeId);

    // mark this participant's status
    await supabase
      .from('language_challenge_participants')
      .update({ status: 'completed' })
      .eq('challenge_id', challengeId)
      .eq('user_id', userId);

    this.logger.log(
      `User ${userId} claimed ${share} coins from challenge ${challengeId} (pool ${prizePool}, split among ${completerIds.length})`,
    );
    return { claimed: true, prize: share };
  }
}
