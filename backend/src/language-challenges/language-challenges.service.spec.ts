import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { LanguageChallengesService } from './language-challenges.service';
import { SupabaseService } from '../supabase/supabase.service';

const baseChallenge = {
  id: '11111111-1111-4111-8111-111111111111',
  creator_id: '22222222-2222-4222-8222-222222222222',
  title: '7-day writing streak',
  description: 'Write every day',
  entry_fee_coins: 25,
  duration_days: 7,
  challenge_type: 'streak' as const,
  prize_pool_coins: 50,
  status: 'open' as const,
  starts_at: '2026-08-20T00:00:00.000Z',
  ends_at: '2099-08-27T00:00:00.000Z',
  completed_at: null,
  created_at: '2026-08-20T00:00:00.000Z',
};

describe('LanguageChallengesService', () => {
  const rpc = vi.fn();
  const from = vi.fn();
  const client = { rpc, from };
  const supabaseService = {
    getClient: vi.fn(() => client),
  } as unknown as SupabaseService;
  let service: LanguageChallengesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LanguageChallengesService(supabaseService);
  });

  it('joins through the atomic database RPC and returns the remaining balance', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        joined: true,
        alreadyJoined: false,
        coinsRemaining: 75,
        prizePoolCoins: 50,
      },
      error: null,
    });

    await expect(
      service.joinChallenge(
        '33333333-3333-4333-8333-333333333333',
        baseChallenge.id,
      ),
    ).resolves.toEqual({
      joined: true,
      alreadyJoined: false,
      coinsRemaining: 75,
      prizePoolCoins: 50,
    });
    expect(rpc).toHaveBeenCalledWith('join_language_challenge', {
      p_challenge_id: baseChallenge.id,
      p_user_id: '33333333-3333-4333-8333-333333333333',
    });
  });

  it('treats a retry after a successful join as idempotent', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        joined: true,
        alreadyJoined: true,
        coinsRemaining: 75,
        prizePoolCoins: 50,
      },
      error: null,
    });

    const result = await service.joinChallenge(
      '33333333-3333-4333-8333-333333333333',
      baseChallenge.id,
    );

    expect(result.alreadyJoined).toBe(true);
    expect(result.coinsRemaining).toBe(75);
  });

  it('maps insufficient-balance failures without leaking provider details', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '22023', message: 'insufficient_coins' },
    });

    await expect(
      service.joinChallenge(
        '33333333-3333-4333-8333-333333333333',
        baseChallenge.id,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('records daily progress through the idempotent check-in RPC', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        checkedIn: true,
        alreadyCheckedIn: true,
        progressDays: 3,
        targetDays: 7,
        activityDate: '2026-08-23',
      },
      error: null,
    });

    await expect(
      service.dailyCheckin(
        '33333333-3333-4333-8333-333333333333',
        baseChallenge.id,
      ),
    ).resolves.toMatchObject({
      checkedIn: true,
      alreadyCheckedIn: true,
      progressDays: 3,
    });
  });

  it('returns the persisted prize when settlement was already completed', async () => {
    rpc.mockResolvedValueOnce({
      data: { claimed: true, alreadySettled: true, prizeCoins: 50 },
      error: null,
    });

    await expect(
      service.claimPrize(
        '33333333-3333-4333-8333-333333333333',
        baseChallenge.id,
      ),
    ).resolves.toEqual({
      claimed: true,
      alreadySettled: true,
      prizeCoins: 50,
    });
  });

  it('fails closed when an RPC returns a malformed response', async () => {
    rpc.mockResolvedValueOnce({ data: { joined: true }, error: null });

    await expect(
      service.joinChallenge(
        '33333333-3333-4333-8333-333333333333',
        baseChallenge.id,
      ),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('lists bounded challenges with only the current users progress', async () => {
    const challengeQuery = {
      select: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      returns: vi
        .fn()
        .mockResolvedValue({ data: [baseChallenge], error: null }),
    };
    const participantQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      returns: vi.fn().mockResolvedValue({
        data: [
          {
            challenge_id: baseChallenge.id,
            status: 'active',
            prize_coins: 0,
          },
        ],
        error: null,
      }),
    };
    const activityQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      returns: vi.fn().mockResolvedValue({
        data: [
          { challenge_id: baseChallenge.id, activity_date: '2026-08-22' },
          { challenge_id: baseChallenge.id, activity_date: '2026-08-23' },
          { challenge_id: baseChallenge.id, activity_date: '2026-08-23' },
        ],
        error: null,
      }),
    };
    from.mockImplementation((table: string) => {
      if (table === 'language_challenges') return challengeQuery;
      if (table === 'language_challenge_participants') return participantQuery;
      if (table === 'language_challenge_daily_activity') return activityQuery;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await service.listChallenges(
      '33333333-3333-4333-8333-333333333333',
      500,
      -10,
    );

    expect(challengeQuery.range).toHaveBeenCalledWith(0, 49);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      joined: true,
      participant_status: 'active',
      progress_days: 2,
      prize_coins: 0,
      ended: false,
    });
  });

  it('surfaces list provider failures instead of misreporting an empty state', async () => {
    const challengeQuery = {
      select: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      returns: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '500', message: 'database unavailable' },
      }),
    };
    from.mockReturnValueOnce(challengeQuery);

    await expect(
      service.listChallenges('33333333-3333-4333-8333-333333333333'),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('creates bounded challenge data and returns a typed summary', async () => {
    const insert = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnThis();
    const single = vi
      .fn()
      .mockResolvedValue({ data: baseChallenge, error: null });
    from.mockReturnValueOnce({ insert, select, single });

    const result = await service.createChallenge(
      '22222222-2222-4222-8222-222222222222',
      {
        title: '  7-day writing streak  ',
        description: '  Write every day  ',
        entryFeeCoins: 25,
        durationDays: 7,
        challengeType: 'streak',
      },
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '7-day writing streak',
        description: 'Write every day',
        entry_fee_coins: 25,
        duration_days: 7,
      }),
    );
    expect(result).toMatchObject({ joined: false, progress_days: 0 });
  });
});
