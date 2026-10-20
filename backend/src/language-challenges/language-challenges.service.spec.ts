import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LanguageChallengesService } from './language-challenges.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MonetisationService } from '../monetisation/monetisation.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';

describe('LanguageChallengesService', () => {
  let service: LanguageChallengesService;
  let monetisationService: MonetisationService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  const baseChallenge = {
    id: 'challenge-1',
    creator_id: 'creator-1',
    title: 'Speak French for a week',
    description: 'Daily check-ins for 7 days',
    entry_fee_coins: 100,
    duration_days: 7,
    challenge_type: 'streak',
    prize_pool_coins: 0,
    status: 'open' as const,
    created_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    mockQueryBuilder = {
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      returns: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LanguageChallengesService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: MonetisationService,
          useValue: {
            deductCoins: vi.fn().mockResolvedValue(0),
            addCoins: vi.fn().mockResolvedValue(0),
          },
        },
      ],
    }).compile();

    service = module.get<LanguageChallengesService>(LanguageChallengesService);
    monetisationService = module.get<MonetisationService>(MonetisationService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createChallenge', () => {
    const dto: CreateChallengeDto = {
      title: 'Speak French for a week',
      description: 'Daily check-ins for 7 days',
      entryFeeCoins: 100,
      durationDays: 7,
      challengeType: 'streak',
    };

    it('creates a challenge and returns its id', async () => {
      const result = await service.createChallenge('creator-1', dto);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'language_challenges',
      );
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          creator_id: 'creator-1',
          title: dto.title,
          description: dto.description,
          entry_fee_coins: 100,
          duration_days: 7,
          challenge_type: 'streak',
          prize_pool_coins: 0,
          status: 'open',
        }),
      );
      expect(result).toEqual({ challengeId: expect.any(String) });
    });

    it('defaults challengeType to streak when not provided', async () => {
      const { challengeType: _omit, ...rest } = dto;
      await service.createChallenge('creator-1', rest);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ challenge_type: 'streak' }),
      );
    });

    it('throws BadRequestException when insert fails', async () => {
      mockQueryBuilder.insert.mockResolvedValue({
        error: { message: 'insert failed' },
      });

      await expect(service.createChallenge('creator-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('listChallenges', () => {
    it('returns open challenges ordered by creation date', async () => {
      mockQueryBuilder.returns.mockResolvedValueOnce({
        data: [baseChallenge],
        error: null,
      });

      const result = await service.listChallenges();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'language_challenges',
      );
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('status', 'open');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(result).toEqual([baseChallenge]);
    });

    it('returns an empty array when the query fails', async () => {
      mockQueryBuilder.returns.mockResolvedValueOnce({
        data: null,
        error: { message: 'boom' },
      });

      const result = await service.listChallenges();

      expect(result).toEqual([]);
    });
  });

  describe('joinChallenge', () => {
    it('throws NotFoundException when the challenge does not exist', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      });
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(
        service.joinChallenge('user-1', 'challenge-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the challenge is not open', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { ...baseChallenge, status: 'closed' },
        error: null,
      });
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(
        service.joinChallenge('user-1', 'challenge-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the user already joined', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: baseChallenge,
        error: null,
      });
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'participant-1' },
        error: null,
      });

      await expect(
        service.joinChallenge('user-1', 'challenge-1'),
      ).rejects.toThrow('You have already joined this challenge');
    });

    it('deducts the entry fee, grows the prize pool and records the participant', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: baseChallenge,
        error: null,
      });
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await service.joinChallenge('user-1', 'challenge-1');

      expect(monetisationService.deductCoins).toHaveBeenCalledWith(
        'user-1',
        100,
      );
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        prize_pool_coins: 100,
      });
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        challenge_id: 'challenge-1',
        user_id: 'user-1',
        status: 'active',
      });
      expect(result).toEqual({ joined: true });
    });
  });

  describe('dailyCheckin', () => {
    it('throws NotFoundException when the challenge does not exist', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      });

      await expect(
        service.dailyCheckin('user-1', 'challenge-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the challenge is not active', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { ...baseChallenge, status: 'completed' },
        error: null,
      });

      await expect(
        service.dailyCheckin('user-1', 'challenge-1'),
      ).rejects.toThrow('Challenge is not active');
    });

    it('throws BadRequestException when the user has not joined', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: baseChallenge,
        error: null,
      });
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(
        service.dailyCheckin('user-1', 'challenge-1'),
      ).rejects.toThrow('You have not joined this challenge');
    });

    it('throws BadRequestException when already checked in today', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: baseChallenge,
        error: null,
      });
      mockQueryBuilder.maybeSingle
        .mockResolvedValueOnce({ data: { id: 'participant-1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'activity-1' }, error: null });

      await expect(
        service.dailyCheckin('user-1', 'challenge-1'),
      ).rejects.toThrow('Already checked in today');
    });

    it('records a check-in for the day', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: baseChallenge,
        error: null,
      });
      mockQueryBuilder.maybeSingle
        .mockResolvedValueOnce({ data: { id: 'participant-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      const result = await service.dailyCheckin('user-1', 'challenge-1');

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          challenge_id: 'challenge-1',
          user_id: 'user-1',
        }),
      );
      expect(result).toEqual({ checkedIn: true });
    });

    it('throws BadRequestException when the check-in insert fails', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: baseChallenge,
        error: null,
      });
      mockQueryBuilder.maybeSingle
        .mockResolvedValueOnce({ data: { id: 'participant-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });
      mockQueryBuilder.insert.mockResolvedValue({
        error: { message: 'insert failed' },
      });

      await expect(
        service.dailyCheckin('user-1', 'challenge-1'),
      ).rejects.toThrow('Failed to record daily checkin');
    });
  });

  describe('claimPrize', () => {
    const completedChallenge = {
      ...baseChallenge,
      duration_days: 3,
      prize_pool_coins: 300,
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    };

    it('throws NotFoundException when the challenge does not exist', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      });

      await expect(service.claimPrize('user-1', 'challenge-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the challenge has already ended', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { ...completedChallenge, status: 'completed' },
        error: null,
      });

      await expect(service.claimPrize('user-1', 'challenge-1')).rejects.toThrow(
        'Challenge has already ended',
      );
    });

    it('throws BadRequestException when the challenge is still running', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { ...completedChallenge, created_at: new Date().toISOString() },
        error: null,
      });

      await expect(service.claimPrize('user-1', 'challenge-1')).rejects.toThrow(
        'Challenge is still running',
      );
    });

    it('throws BadRequestException when the user did not join the challenge', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: completedChallenge,
        error: null,
      });
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(service.claimPrize('user-1', 'challenge-1')).rejects.toThrow(
        'You did not join this challenge',
      );
    });

    it('throws BadRequestException when the user has not met the daily requirement', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: completedChallenge,
        error: null,
      });
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'participant-1' },
        error: null,
      });
      mockQueryBuilder.returns
        .mockReturnValueOnce(mockQueryBuilder) // challenge fetch, chained with .single()
        .mockResolvedValueOnce({
          data: [{ activity_date: '2026-01-01' }],
          error: null,
        });

      await expect(service.claimPrize('user-1', 'challenge-1')).rejects.toThrow(
        'You need at least 3 daily checkins to complete this challenge. You have 1.',
      );
    });

    it('throws BadRequestException when the daily activity lookup fails', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: completedChallenge,
        error: null,
      });
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'participant-1' },
        error: null,
      });
      mockQueryBuilder.returns
        .mockReturnValueOnce(mockQueryBuilder) // challenge fetch, chained with .single()
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'boom' },
        });

      await expect(service.claimPrize('user-1', 'challenge-1')).rejects.toThrow(
        'Failed to retrieve daily activity',
      );
    });

    it('awards the full prize pool to the sole completer', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: completedChallenge,
        error: null,
      });
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'participant-1' },
        error: null,
      });
      mockQueryBuilder.returns
        .mockReturnValueOnce(mockQueryBuilder) // challenge fetch, chained with .single()
        // claimant's own distinct check-in days
        .mockResolvedValueOnce({
          data: [
            { activity_date: '2026-01-01' },
            { activity_date: '2026-01-02' },
            { activity_date: '2026-01-03' },
          ],
          error: null,
        })
        // all participants in the challenge
        .mockResolvedValueOnce({
          data: [{ user_id: 'user-1' }],
          error: null,
        })
        // all participant activities instead of looping
        .mockResolvedValueOnce({
          data: [
            { user_id: 'user-1', activity_date: '2026-01-01' },
            { user_id: 'user-1', activity_date: '2026-01-02' },
            { user_id: 'user-1', activity_date: '2026-01-03' },
          ],
          error: null,
        });

      const result = await service.claimPrize('user-1', 'challenge-1');

      expect(monetisationService.addCoins).toHaveBeenCalledWith('user-1', 300);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        status: 'completed',
        prize_pool_coins: 0,
      });
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        status: 'completed',
      });
      expect(result).toEqual({ claimed: true, prize: 300 });
    });

    it('splits the prize pool between multiple completers and leaves the remainder in the pool', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: completedChallenge,
        error: null,
      });
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'participant-1' },
        error: null,
      });
      const threeDays = [
        { activity_date: '2026-01-01' },
        { activity_date: '2026-01-02' },
        { activity_date: '2026-01-03' },
      ];
      mockQueryBuilder.returns
        .mockReturnValueOnce(mockQueryBuilder) // challenge fetch, chained with .single()
        .mockResolvedValueOnce({ data: threeDays, error: null }) // claimant's days
        .mockResolvedValueOnce({
          data: [{ user_id: 'user-1' }, { user_id: 'user-2' }],
          error: null,
        }) // all participants
        .mockResolvedValueOnce({
          data: [
            { user_id: 'user-1', activity_date: '2026-01-01' },
            { user_id: 'user-1', activity_date: '2026-01-02' },
            { user_id: 'user-1', activity_date: '2026-01-03' },
            { user_id: 'user-2', activity_date: '2026-01-01' },
            { user_id: 'user-2', activity_date: '2026-01-02' },
            { user_id: 'user-2', activity_date: '2026-01-03' },
          ],
          error: null,
        }); // all activities

      const result = await service.claimPrize('user-1', 'challenge-1');

      // prize pool 300 split between 2 completers = 150 each, no remainder
      expect(monetisationService.addCoins).toHaveBeenNthCalledWith(
        1,
        'user-1',
        150,
      );
      expect(monetisationService.addCoins).toHaveBeenNthCalledWith(
        2,
        'user-2',
        150,
      );
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        status: 'completed',
        prize_pool_coins: 0,
      });
      expect(result).toEqual({ claimed: true, prize: 150 });
    });

    it('pays only the participants who met the daily requirement', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: completedChallenge,
        error: null,
      });
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'participant-1' },
        error: null,
      });
      const threeDays = [
        { activity_date: '2026-01-01' },
        { activity_date: '2026-01-02' },
        { activity_date: '2026-01-03' },
      ];
      mockQueryBuilder.returns
        .mockReturnValueOnce(mockQueryBuilder) // challenge fetch, chained with .single()
        .mockResolvedValueOnce({ data: threeDays, error: null }) // claimant's days
        .mockResolvedValueOnce({
          data: [{ user_id: 'user-1' }, { user_id: 'user-2' }],
          error: null,
        }) // all participants
        .mockResolvedValueOnce({
          data: [
            { user_id: 'user-1', activity_date: '2026-01-01' },
            { user_id: 'user-1', activity_date: '2026-01-02' },
            { user_id: 'user-1', activity_date: '2026-01-03' },
            { user_id: 'user-2', activity_date: '2026-01-01' },
          ],
          error: null,
        }); // all activities

      const result = await service.claimPrize('user-1', 'challenge-1');

      expect(monetisationService.addCoins).toHaveBeenCalledTimes(1);
      expect(monetisationService.addCoins).toHaveBeenCalledWith('user-1', 300);
      expect(result).toEqual({ claimed: true, prize: 300 });
    });

    it('throws BadRequestException when no participant completed the challenge', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: completedChallenge,
        error: null,
      });
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'participant-1' },
        error: null,
      });
      const threeDays = [
        { activity_date: '2026-01-01' },
        { activity_date: '2026-01-02' },
        { activity_date: '2026-01-03' },
      ];
      const oneDay = [{ activity_date: '2026-01-01' }];
      mockQueryBuilder.returns
        .mockReturnValueOnce(mockQueryBuilder) // challenge fetch, chained with .single()
        .mockResolvedValueOnce({ data: threeDays, error: null }) // claimant meets the requirement...
        .mockResolvedValueOnce({
          data: [{ user_id: 'user-1' }, { user_id: 'user-2' }],
          error: null,
        }) // all participants
        .mockResolvedValueOnce({
          data: [
            { user_id: 'user-1', activity_date: '2026-01-01' },
            { user_id: 'user-2', activity_date: '2026-01-01' },
          ],
          error: null,
        }); // all activities

      await expect(service.claimPrize('user-1', 'challenge-1')).rejects.toThrow(
        'No participants completed the challenge',
      );
    });
  });
});
