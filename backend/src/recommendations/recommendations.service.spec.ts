import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  RecommendationsService,
  RecommendedUserDto,
} from './recommendations.service';
import { CircuitBreakerService } from '../escrow/circuit-breaker.service';
import { MatchmakingCrashReportService } from './matchmaking-crash-report.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from '../metrics/metrics.service';
import { SafetyService } from '../safety/safety.service';

vi.mock('../common/retry', async () => {
  const actual =
    await vi.importActual<typeof import('../common/retry')>('../common/retry');
  return {
    withRetry: vi.fn((fn: () => unknown) => fn()),
    isRateLimitError: actual.isRateLimitError,
  };
});

type QueryChainMock = {
  select: Mock;
  eq: Mock;
  neq: Mock;
  in: Mock;
  contains: Mock;
  order: Mock;
  limit: Mock;
  single: Mock;
  maybeSingle: Mock;
  match: Mock;
  is: Mock;
  _setResolve: (data: unknown, error?: { message: string } | null) => void;
  then: (resolve: (value: unknown) => void) => undefined;
};

const makeQueryChain = (): QueryChainMock => {
  const resolveHolder: { data: unknown; error: { message: string } | null } = {
    data: null,
    error: null,
  };

  const chain = {
    _setResolve(data: unknown, error: { message: string } | null = null) {
      resolveHolder.data = data;
      resolveHolder.error = error;
    },
  } as Partial<QueryChainMock>;

  const methodNames = [
    'select',
    'eq',
    'neq',
    'not',
    'in',
    'overlaps',
    'contains',
    'order',
    'limit',
    'single',
    'maybeSingle',
    'match',
    'is',
  ];
  methodNames.forEach((m) => {
    (chain as Record<string, unknown>)[m] = vi.fn().mockReturnValue(chain);
  });

  (chain as Record<string, unknown>)['then'] = (
    resolve: (value: unknown) => void,
  ) => {
    resolve(resolveHolder);
    return undefined;
  };

  return chain as QueryChainMock;
};

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let mockRedis: {
    get: Mock;
    set: Mock;
    del: Mock;
    pipeline: Mock;
  };
  let mockPipeline: { set: Mock; exec: Mock };
  let mockFrom: Mock;
  let mockLogger: {
    info: Mock;
    warn: Mock;
    error: Mock;
    debug: Mock;
  };
  let mockMetricsService: {
    recordMatchmakingRecommendationsGenerated: Mock;
    recordMatchmakingRecommendationsPerRequest: Mock;
    recordMatchmakingFallbackTierUsed: Mock;
    recordMatchmakingEmptyResults: Mock;
    recordMatchmakingRequestDuration: Mock;
    recordMatchmakingDailyCacheMiss: Mock;
    setMatchmakingTierSuccessRate: Mock;
  };
  let mockCrashReportService: { reportCrash: Mock };
  let mockSafetyService: { getBlockedAndBlockerIds: Mock };

  beforeEach(async () => {
    mockPipeline = {
      set: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(undefined),
    };

    mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      pipeline: vi.fn().mockReturnValue(mockPipeline),
    };

    mockFrom = vi.fn();

    mockMetricsService = {
      recordMatchmakingRecommendationsGenerated: vi.fn(),
      recordMatchmakingRecommendationsPerRequest: vi.fn(),
      recordMatchmakingFallbackTierUsed: vi.fn(),
      recordMatchmakingEmptyResults: vi.fn(),
      recordMatchmakingRequestDuration: vi.fn(),
      recordMatchmakingDailyCacheMiss: vi.fn(),
      setMatchmakingTierSuccessRate: vi.fn(),
    };

    mockCrashReportService = {
      reportCrash: vi.fn().mockResolvedValue({}),
    };
    mockSafetyService = {
      getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        {
          provide: `PinoLogger:${RecommendationsService.name}`,
          useValue: mockLogger,
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue({
              from: mockFrom,
            }),
            getRedisClient: vi.fn().mockReturnValue(mockRedis),
          },
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
        {
          provide: SafetyService,
          useValue: mockSafetyService,
        },
        {
          provide: CircuitBreakerService,
          useValue: {
            isAvailable: vi.fn().mockReturnValue(true),
            recordSuccess: vi.fn(),
            recordFailure: vi.fn(),
            getState: vi.fn().mockReturnValue({
              isOpen: false,
              failureCount: 0,
              lastFailure: 0,
              cooldownUntil: 0,
              totalFailures: 0,
              totalSuccesses: 0,
            }),
            executeWithBreaker: vi
              .fn()
              .mockImplementation((_svc: string, op: () => Promise<unknown>) =>
                op(),
              ),
          },
        },
        {
          provide: MatchmakingCrashReportService,
          useValue: mockCrashReportService,
        },
      ],
    }).compile();

    service = module.get<RecommendationsService>(RecommendationsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateDailyRecommendations', () => {
    it('should cache full DTOs for language exchange matches in Redis', async () => {
      const usersChain = makeQueryChain();
      usersChain._setResolve([
        {
          id: 'user-a',
          native_languages: ['en'],
          target_languages: ['es'],
        },
      ]);

      const matchesChain = makeQueryChain();
      matchesChain._setResolve([
        {
          id: 'partner-1',
          display_name: 'Partner 1',
          avatar_url: 'http://img/1.png',
          native_languages: ['es'],
          target_languages: ['en'],
          is_serious_learner: true,
          study_streak_days: 30,
          correction_ratio: 0.95,
        },
        {
          id: 'partner-2',
          display_name: 'Partner 2',
          avatar_url: null,
          native_languages: ['es'],
          target_languages: ['en'],
          is_serious_learner: false,
          study_streak_days: 3,
          correction_ratio: 0.5,
        },
      ]);

      mockFrom
        .mockReturnValueOnce(usersChain)
        .mockReturnValueOnce(matchesChain);

      await service.calculateDailyRecommendations();

      const privacyFilters = {
        is_deleted: false,
        privacy_hide_from_search: false,
        is_deletion_pending: false,
      };
      expect(usersChain.match).toHaveBeenCalledWith(privacyFilters);
      expect(usersChain.is).toHaveBeenCalledWith(
        'scheduled_for_deletion_at',
        null,
      );
      expect(matchesChain.match).toHaveBeenCalledWith(privacyFilters);
      expect(matchesChain.is).toHaveBeenCalledWith(
        'scheduled_for_deletion_at',
        null,
      );

      expect(mockPipeline.set).toHaveBeenCalledTimes(1);
      expect(mockPipeline.set.mock.calls[0][0]).toBe(
        'recommendations:daily:user-a',
      );

      const parsed: RecommendedUserDto[] = JSON.parse(
        mockPipeline.set.mock.calls[0][1],
      );
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe('partner-1');
      expect(parsed[0].displayName).toBe('Partner 1');
      expect(parsed[1].id).toBe('partner-2');
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should handle empty users gracefully', async () => {
      const chain = makeQueryChain();
      chain._setResolve([]);
      mockFrom.mockReturnValueOnce(chain);

      await service.calculateDailyRecommendations();
      expect(mockPipeline.set).not.toHaveBeenCalled();
    });

    it('should handle Supabase error gracefully', async () => {
      const chain = makeQueryChain();
      chain._setResolve(null, { message: 'DB error' });
      mockFrom.mockReturnValueOnce(chain);

      await service.calculateDailyRecommendations();
      expect(mockPipeline.set).not.toHaveBeenCalled();
    });

    it('should skip users without target languages', async () => {
      const chain = makeQueryChain();
      chain._setResolve([
        {
          id: 'user-a',
          native_languages: ['en'],
          target_languages: null,
        },
      ]);
      mockFrom.mockReturnValueOnce(chain);

      await service.calculateDailyRecommendations();
      expect(mockPipeline.set).not.toHaveBeenCalled();
    });
  });

  describe('getDailyRecommendations', () => {
    it('should return cached DTOs from Redis', async () => {
      const dtos: RecommendedUserDto[] = [
        {
          id: 'p-1',
          displayName: 'Partner 1',
          avatarUrl: null,
          nativeLanguage: 'es',
          targetLanguages: ['en'],
          sharedInterests: 0,
          isSeriousLearner: true,
          studyStreakDays: 30,
          correctionRatio: 0.95,
        },
      ];
      mockRedis.get.mockResolvedValue(JSON.stringify(dtos));
      const eligibilityChain = makeQueryChain();
      eligibilityChain._setResolve([{ id: 'p-1' }]);
      mockFrom.mockReturnValueOnce(eligibilityChain);

      const result = await service.getDailyRecommendations('user-123');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p-1');
      expect(eligibilityChain.match).toHaveBeenCalledWith({
        is_deleted: false,
        privacy_hide_from_search: false,
        is_deletion_pending: false,
      });
      expect(eligibilityChain.is).toHaveBeenCalledWith(
        'scheduled_for_deletion_at',
        null,
      );
    });

    it('removes newly hidden or deleting users from cached recommendations', async () => {
      const dtos = [
        {
          id: 'eligible',
          displayName: 'Eligible',
          avatarUrl: null,
          nativeLanguage: 'es',
          targetLanguages: ['en'],
          sharedInterests: 0,
          isSeriousLearner: true,
          studyStreakDays: 12,
          correctionRatio: 0.9,
        },
        {
          id: 'deleting',
          displayName: 'Deleting',
          avatarUrl: null,
          nativeLanguage: 'fr',
          targetLanguages: ['en'],
          sharedInterests: 0,
          isSeriousLearner: false,
          studyStreakDays: 2,
          correctionRatio: 0.5,
        },
      ] satisfies RecommendedUserDto[];
      mockRedis.get.mockResolvedValue(JSON.stringify(dtos));
      const eligibilityChain = makeQueryChain();
      eligibilityChain._setResolve([{ id: 'eligible' }]);
      mockFrom.mockReturnValueOnce(eligibilityChain);

      const result = await service.getDailyRecommendations('user-123');

      expect(result.map((candidate) => candidate.id)).toEqual(['eligible']);
    });

    it('removes blocked users from cached recommendations', async () => {
      const dtos = [
        {
          id: 'eligible',
          displayName: 'Eligible',
          avatarUrl: null,
          nativeLanguage: 'es',
          targetLanguages: ['en'],
          sharedInterests: 0,
          isSeriousLearner: true,
          studyStreakDays: 12,
          correctionRatio: 0.9,
        },
        {
          id: 'blocked',
          displayName: 'Blocked',
          avatarUrl: null,
          nativeLanguage: 'fr',
          targetLanguages: ['en'],
          sharedInterests: 0,
          isSeriousLearner: false,
          studyStreakDays: 2,
          correctionRatio: 0.5,
        },
      ] satisfies RecommendedUserDto[];
      mockRedis.get.mockResolvedValue(JSON.stringify(dtos));
      mockSafetyService.getBlockedAndBlockerIds.mockResolvedValue(['blocked']);
      const eligibilityChain = makeQueryChain();
      eligibilityChain._setResolve([{ id: 'eligible' }, { id: 'blocked' }]);
      mockFrom.mockReturnValueOnce(eligibilityChain);

      const result = await service.getDailyRecommendations('user-123');

      expect(result.map((candidate) => candidate.id)).toEqual(['eligible']);
      expect(mockSafetyService.getBlockedAndBlockerIds).toHaveBeenCalledWith(
        'user-123',
      );
    });

    it('never returns cached users when privacy revalidation fails', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify([
          {
            id: 'cached-user',
            displayName: 'Cached',
            avatarUrl: null,
            nativeLanguage: 'es',
            targetLanguages: ['en'],
            sharedInterests: 0,
            isSeriousLearner: true,
            studyStreakDays: 3,
            correctionRatio: 0.8,
          },
        ] satisfies RecommendedUserDto[]),
      );
      const eligibilityChain = makeQueryChain();
      eligibilityChain._setResolve(null, { message: 'revalidation offline' });
      const liveUserChain = makeQueryChain();
      liveUserChain._setResolve(null, { message: 'fallback offline' });
      mockFrom
        .mockReturnValueOnce(eligibilityChain)
        .mockReturnValueOnce(liveUserChain);

      const result = await service.getDailyRecommendations('user-123');

      expect(result).toEqual([]);
      expect(result.map((candidate) => candidate.id)).not.toContain(
        'cached-user',
      );
    });

    it('should return empty array when nothing cached', async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await service.getDailyRecommendations('user-123');
      expect(result).toEqual([]);
    });

    it('should return empty array on parse failure', async () => {
      mockRedis.get.mockResolvedValue('not-valid-json');
      const result = await service.getDailyRecommendations('user-123');
      expect(result).toEqual([]);
    });

    it('should return empty array when cached value is not an array', async () => {
      mockRedis.get.mockResolvedValue('"just a string"');
      const result = await service.getDailyRecommendations('user-123');
      expect(result).toEqual([]);
    });

    it('should fall back to language exchange when Redis fails', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection refused'));

      // Mock the language exchange fallback chain
      const userChain = makeQueryChain();
      userChain._setResolve({
        id: 'user-123',
        native_languages: ['en'],
        target_languages: ['es'],
      });

      const matchesChain = makeQueryChain();
      matchesChain._setResolve([
        {
          id: 'partner-1',
          display_name: 'Partner 1',
          avatar_url: null,
          native_languages: ['es'],
          target_languages: ['en'],
          is_serious_learner: true,
          study_streak_days: 30,
          correction_ratio: 0.95,
        },
      ]);

      mockFrom.mockReturnValueOnce(userChain).mockReturnValueOnce(matchesChain);

      const result = await service.getDailyRecommendations('user-123');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('partner-1');
    });

    it('should return empty array when Redis fails and live fallback also fails', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection refused'));

      const userChain = makeQueryChain();
      userChain._setResolve(null, { message: 'Users table offline' });

      mockFrom.mockReturnValueOnce(userChain);

      const result = await service.getDailyRecommendations('user-123');
      expect(result).toEqual([]);
    });

    it('removes blocked users from the live daily fallback', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection refused'));
      mockSafetyService.getBlockedAndBlockerIds.mockResolvedValue([
        'blocked-partner',
      ]);
      const userChain = makeQueryChain();
      userChain._setResolve({
        id: 'user-123',
        native_languages: ['en'],
        target_languages: ['es'],
      });
      const matchesChain = makeQueryChain();
      matchesChain._setResolve([
        {
          id: 'blocked-partner',
          display_name: 'Blocked Partner',
          native_languages: ['es'],
          target_languages: ['en'],
        },
      ]);
      mockFrom.mockReturnValueOnce(userChain).mockReturnValueOnce(matchesChain);

      const result = await service.getDailyRecommendations('user-123');

      expect(result).toEqual([]);
    });

    it('should return empty array when Redis fails and live fallback throws', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection refused'));
      mockFrom.mockImplementation(() => {
        throw new Error('Unexpected database crash');
      });

      const result = await service.getDailyRecommendations('user-123');
      expect(result).toEqual([]);
    });
  });

  describe('getRecommendations (graceful degradation)', () => {
    it('should return interest-based results when available', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve([{ tag: 'sports' }, { tag: 'music' }]);

      const sharedChain = makeQueryChain();
      sharedChain._setResolve([
        { user_id: 'candidate-1', tag: 'sports' },
        { user_id: 'candidate-1', tag: 'music' },
      ]);

      const usersChain = makeQueryChain();
      usersChain._setResolve([
        {
          id: 'candidate-1',
          display_name: 'Candidate 1',
          avatar_url: null,
          native_languages: ['es'],
          target_languages: ['en'],
          is_serious_learner: true,
          study_streak_days: 15,
          correction_ratio: 0.9,
        },
      ]);

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(sharedChain)
        .mockReturnValueOnce(usersChain);

      const result = await service.getRecommendations('user-123');
      expect(result).toHaveLength(1);
      expect(result[0].sharedInterests).toBe(2);
    });

    it('should fall back to language exchange when interests return empty', async () => {
      // Tier 1: tags chain returns no tags
      const tagsChain = makeQueryChain();
      tagsChain._setResolve([]);

      // Tier 2: language exchange chain
      const userChain = makeQueryChain();
      userChain._setResolve({
        id: 'user-123',
        native_languages: ['en'],
        target_languages: ['es'],
      });

      const matchesChain = makeQueryChain();
      matchesChain._setResolve([
        {
          id: 'lang-partner',
          display_name: 'Lang Partner',
          avatar_url: null,
          native_languages: ['es'],
          target_languages: ['en'],
          is_serious_learner: true,
          study_streak_days: 20,
          correction_ratio: 0.88,
        },
      ]);

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(userChain)
        .mockReturnValueOnce(matchesChain);

      const result = await service.getRecommendations('user-123');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('lang-partner');
    });

    it('should fall back to active users when interests and language exchange both return empty', async () => {
      // Tier 1: tags chain returns no tags
      const tagsChain = makeQueryChain();
      tagsChain._setResolve([]);

      // Tier 2: user has no target languages
      const userChain = makeQueryChain();
      userChain._setResolve({
        id: 'user-123',
        native_languages: ['en'],
        target_languages: null,
      });

      // Tier 3: active users chain
      const activeChain = makeQueryChain();
      activeChain._setResolve([
        {
          id: 'active-user',
          display_name: 'Active User',
          avatar_url: null,
          native_languages: ['fr'],
          target_languages: ['en'],
          is_serious_learner: true,
          study_streak_days: 50,
          correction_ratio: 0.95,
        },
      ]);

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(userChain)
        .mockReturnValueOnce(activeChain);

      const result = await service.getRecommendations('user-123');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('active-user');
    });

    it('should fall back to mock data when all tiers fail', async () => {
      // Tier 1: tags error
      const tagsChain = makeQueryChain();
      tagsChain._setResolve(null, { message: 'DB error' });

      // Tier 2: user lookup error
      const userChain = makeQueryChain();
      userChain._setResolve(null, { message: 'DB error' });

      // Tier 3: active users error
      const activeChain = makeQueryChain();
      activeChain._setResolve(null, { message: 'DB error' });

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(userChain)
        .mockReturnValueOnce(activeChain);

      const result = await service.getRecommendations('user-123');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].matchTier).toBe('mock');
    });

    it('should sort interest matches by sharedInterests, isSeriousLearner, then studyStreakDays', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve([{ tag: 'sports' }, { tag: 'music' }]);

      const sharedChain = makeQueryChain();
      sharedChain._setResolve([
        { user_id: 'c-low', tag: 'sports' },
        { user_id: 'c-high-serious', tag: 'sports' },
        { user_id: 'c-high-serious', tag: 'music' },
        { user_id: 'c-high-not-serious', tag: 'sports' },
        { user_id: 'c-high-not-serious', tag: 'music' },
      ]);

      const usersChain = makeQueryChain();
      usersChain._setResolve([
        {
          id: 'c-low',
          display_name: 'Low',
          avatar_url: null,
          native_languages: ['es'],
          target_languages: ['en'],
          is_serious_learner: true,
          study_streak_days: 100,
          correction_ratio: 0.9,
        },
        {
          id: 'c-high-serious',
          display_name: 'HighSerious',
          avatar_url: null,
          native_languages: ['es'],
          target_languages: ['en'],
          is_serious_learner: true,
          study_streak_days: 10,
          correction_ratio: 0.9,
        },
        {
          id: 'c-high-not-serious',
          display_name: 'HighNotSerious',
          avatar_url: null,
          native_languages: ['es'],
          target_languages: ['en'],
          is_serious_learner: false,
          study_streak_days: 50,
          correction_ratio: 0.9,
        },
      ]);

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(sharedChain)
        .mockReturnValueOnce(usersChain);

      const result = await service.getRecommendations('user-123');
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('c-high-serious');
      expect(result[1].id).toBe('c-high-not-serious');
      expect(result[2].id).toBe('c-low');
    });

    it('should fall to active users when language exchange returns no matches', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve([]);

      const userChain = makeQueryChain();
      userChain._setResolve({
        id: 'user-123',
        native_languages: ['en'],
        target_languages: ['ja'],
      });

      const matchesChain = makeQueryChain();
      matchesChain._setResolve([]);

      const activeChain = makeQueryChain();
      activeChain._setResolve([
        {
          id: 'active-user',
          display_name: 'Active User',
          avatar_url: null,
          native_languages: ['fr'],
          target_languages: ['en'],
          is_serious_learner: true,
          study_streak_days: 40,
          correction_ratio: 0.85,
        },
      ]);

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(userChain)
        .mockReturnValueOnce(matchesChain)
        .mockReturnValueOnce(activeChain);

      const result = await service.getRecommendations('user-123');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('active-user');
    });

    it('should skip language exchange when user has no native_languages', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve([]);

      const userChain = makeQueryChain();
      userChain._setResolve({
        id: 'user-123',
        native_languages: null,
        target_languages: ['es', 'fr'],
      });

      const activeChain = makeQueryChain();
      activeChain._setResolve([
        {
          id: 'active-p',
          display_name: 'Active P',
          avatar_url: null,
          native_languages: ['de'],
          target_languages: ['en'],
          is_serious_learner: false,
          study_streak_days: 12,
          correction_ratio: 0.75,
        },
      ]);

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(userChain)
        .mockReturnValueOnce(activeChain);

      const result = await service.getRecommendations('user-123');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('active-p');
    });

    it('should degrade through all three error tiers before reaching mock', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve(null, { message: 'Interests table offline' });

      const userChain = makeQueryChain();
      userChain._setResolve(null, { message: 'Users table offline' });

      const activeChain = makeQueryChain();
      activeChain._setResolve(null, { message: 'Users table offline' });

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(userChain)
        .mockReturnValueOnce(activeChain);

      const result = await service.getRecommendations('user-123');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].matchTier).toBe('mock');
    });
  });

  describe('getRecommendationsWithFallback', () => {
    it('should return interest-based results tagged with matchTier', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve([{ tag: 'sports' }]);

      const sharedChain = makeQueryChain();
      sharedChain._setResolve([{ user_id: 'c-1', tag: 'sports' }]);

      const usersChain = makeQueryChain();
      usersChain._setResolve([
        {
          id: 'c-1',
          display_name: 'C1',
          avatar_url: null,
          native_languages: ['es'],
          target_languages: ['en'],
          is_serious_learner: true,
          study_streak_days: 10,
          correction_ratio: 0.8,
        },
      ]);

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(sharedChain)
        .mockReturnValueOnce(usersChain);

      const result = await service.getRecommendationsWithFallback('user-123');
      expect(result).toHaveLength(1);
      expect(result[0].matchTier).toBe('interest');
      expect(result[0].id).toBe('c-1');
    });

    it('should fall back to language exchange when interests returns empty', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve([]);

      const userChain = makeQueryChain();
      userChain._setResolve({
        id: 'user-123',
        native_languages: ['en'],
        target_languages: ['es'],
      });

      const matchesChain = makeQueryChain();
      matchesChain._setResolve([
        {
          id: 'lang-p',
          display_name: 'Lang P',
          avatar_url: null,
          native_languages: ['es'],
          target_languages: ['en'],
          is_serious_learner: false,
          study_streak_days: 5,
          correction_ratio: 0.7,
        },
      ]);

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(userChain)
        .mockReturnValueOnce(matchesChain);

      const result = await service.getRecommendationsWithFallback('user-123');
      expect(result).toHaveLength(1);
      expect(result[0].matchTier).toBe('language_exchange');
      expect(result[0].id).toBe('lang-p');
    });

    it('should fall back to active users when tiers 1 and 2 produce empty', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve([]);

      const userChain = makeQueryChain();
      userChain._setResolve({
        id: 'user-123',
        native_languages: null,
        target_languages: null,
      });

      const activeChain = makeQueryChain();
      activeChain._setResolve([
        {
          id: 'active-u',
          display_name: 'Active U',
          avatar_url: null,
          native_languages: ['de'],
          target_languages: ['en'],
          is_serious_learner: true,
          study_streak_days: 40,
          correction_ratio: 0.9,
        },
      ]);

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(userChain)
        .mockReturnValueOnce(activeChain);

      const result = await service.getRecommendationsWithFallback('user-123');
      expect(result).toHaveLength(1);
      expect(result[0].matchTier).toBe('active_users');
      expect(result[0].id).toBe('active-u');
    });

    it('should fall back to mock data when all real tiers fail', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve(null, { message: 'Interests DB down' });

      const userChain = makeQueryChain();
      userChain._setResolve(null, { message: 'Users DB down' });

      const activeChain = makeQueryChain();
      activeChain._setResolve(null, { message: 'Users DB down' });

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(userChain)
        .mockReturnValueOnce(activeChain);

      const result = await service.getRecommendationsWithFallback('user-123');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].matchTier).toBe('mock');
    });

    it('should exclude the requesting user from mock data results', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve(null, { message: 'Interests DB down' });

      const userChain = makeQueryChain();
      userChain._setResolve(null, { message: 'Users DB down' });

      const activeChain = makeQueryChain();
      activeChain._setResolve(null, { message: 'Users DB down' });

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(userChain)
        .mockReturnValueOnce(activeChain);

      // Using 'fake-1' which exists in MOCK_USERS
      const result = await service.getRecommendationsWithFallback('fake-1');
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((r) => r.id !== 'fake-1')).toBe(true);
    });

    it('should limit mock data results to FALLBACK_LIMIT', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve(null, { message: 'Interests DB down' });

      const userChain = makeQueryChain();
      userChain._setResolve(null, { message: 'Users DB down' });

      const activeChain = makeQueryChain();
      activeChain._setResolve(null, { message: 'Users DB down' });

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(userChain)
        .mockReturnValueOnce(activeChain);

      const result =
        await service.getRecommendationsWithFallback('unknown-user');
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it('should fall to active users when language exchange matches query fails', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve([]);

      const userChain = makeQueryChain();
      userChain._setResolve({
        id: 'user-123',
        native_languages: ['en'],
        target_languages: ['es'],
      });

      const matchesChain = makeQueryChain();
      matchesChain._setResolve(null, { message: 'Match query error' });

      const activeChain = makeQueryChain();
      activeChain._setResolve([
        {
          id: 'active-u',
          display_name: 'Active U',
          avatar_url: null,
          native_languages: ['de'],
          target_languages: ['en'],
          is_serious_learner: true,
          study_streak_days: 30,
          correction_ratio: 0.82,
        },
      ]);

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(userChain)
        .mockReturnValueOnce(matchesChain)
        .mockReturnValueOnce(activeChain);

      const result = await service.getRecommendationsWithFallback('user-123');
      expect(result).toHaveLength(1);
      expect(result[0].matchTier).toBe('active_users');
      expect(result[0].id).toBe('active-u');
    });

    it('should skip language exchange tier when user profile fetch fails', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve([]);

      const userChain = makeQueryChain();
      userChain._setResolve(null, { message: 'User not found' });

      const activeChain = makeQueryChain();
      activeChain._setResolve([
        {
          id: 'fallback-u',
          display_name: 'Fallback U',
          avatar_url: null,
          native_languages: ['pt'],
          target_languages: ['en'],
          is_serious_learner: false,
          study_streak_days: 8,
          correction_ratio: 0.65,
        },
      ]);

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(userChain)
        .mockReturnValueOnce(activeChain);

      const result = await service.getRecommendationsWithFallback('user-123');
      expect(result).toHaveLength(1);
      expect(result[0].matchTier).toBe('active_users');
    });

    it('should correctly map all DTO fields from language exchange matches', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve([]);

      const userChain = makeQueryChain();
      userChain._setResolve({
        id: 'user-123',
        native_languages: ['en'],
        target_languages: ['es', 'fr'],
      });

      const matchesChain = makeQueryChain();
      matchesChain._setResolve([
        {
          id: 'full-partner',
          display_name: 'Full Partner',
          avatar_url: 'https://img.example/avatar.png',
          native_languages: ['es'],
          target_languages: ['en', 'pt'],
          is_serious_learner: true,
          study_streak_days: 42,
          correction_ratio: 0.92,
        },
      ]);

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(userChain)
        .mockReturnValueOnce(matchesChain);

      const result = await service.getRecommendationsWithFallback('user-123');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'full-partner',
        displayName: 'Full Partner',
        avatarUrl: 'https://img.example/avatar.png',
        nativeLanguage: 'es',
        targetLanguages: ['en', 'pt'],
        sharedInterests: 0,
        isSeriousLearner: true,
        studyStreakDays: 42,
        correctionRatio: 0.92,
        matchTier: 'language_exchange',
      });
    });

    it('should handle interest tier with tags but no shared users', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve([{ tag: 'sports' }, { tag: 'obscure-hobby' }]);

      const sharedChain = makeQueryChain();
      sharedChain._setResolve([]);

      const userChain = makeQueryChain();
      userChain._setResolve({
        id: 'user-123',
        native_languages: ['en'],
        target_languages: ['es'],
      });

      const matchesChain = makeQueryChain();
      matchesChain._setResolve([
        {
          id: 'lang-match',
          display_name: 'Lang Match',
          avatar_url: null,
          native_languages: ['es'],
          target_languages: ['en'],
          is_serious_learner: true,
          study_streak_days: 25,
          correction_ratio: 0.88,
        },
      ]);

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(sharedChain)
        .mockReturnValueOnce(userChain)
        .mockReturnValueOnce(matchesChain);

      const result = await service.getRecommendationsWithFallback('user-123');
      expect(result).toHaveLength(1);
      expect(result[0].matchTier).toBe('language_exchange');
    });

    it('should handle getRecommendations when interest shared query succeeds but no users match', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve([{ tag: 'sports' }]);

      const sharedChain = makeQueryChain();
      sharedChain._setResolve([{ user_id: 'other-user', tag: 'sports' }]);

      const usersChain = makeQueryChain();
      usersChain._setResolve([]);

      const userChain = makeQueryChain();
      userChain._setResolve({
        id: 'user-123',
        native_languages: ['en'],
        target_languages: ['es'],
      });

      const matchesChain = makeQueryChain();
      matchesChain._setResolve([
        {
          id: 'lang-partner',
          display_name: 'Lang Partner',
          avatar_url: null,
          native_languages: ['es'],
          target_languages: ['en'],
          is_serious_learner: false,
          study_streak_days: 7,
          correction_ratio: 0.6,
        },
      ]);

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(sharedChain)
        .mockReturnValueOnce(usersChain)
        .mockReturnValueOnce(userChain)
        .mockReturnValueOnce(matchesChain);

      const result = await service.getRecommendations('user-123');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('lang-partner');
    });

    it('should handle calculateDailyRecommendations with multiple users and diverse language pairs', async () => {
      const usersChain = makeQueryChain();
      usersChain._setResolve([
        { id: 'user-a', native_languages: ['en'], target_languages: ['es'] },
        {
          id: 'user-b',
          native_languages: ['ja'],
          target_languages: ['en', 'ko'],
        },
        { id: 'user-c', native_languages: ['es'], target_languages: ['en'] },
        { id: 'user-d', native_languages: ['en'], target_languages: null },
      ]);

      const matchesForA = makeQueryChain();
      matchesForA._setResolve([
        {
          id: 'user-c',
          display_name: 'User C',
          avatar_url: null,
          native_languages: ['es'],
          target_languages: ['en'],
          is_serious_learner: true,
          study_streak_days: 20,
          correction_ratio: 0.9,
        },
      ]);

      const matchesForB = makeQueryChain();
      matchesForB._setResolve([]);

      const matchesForC = makeQueryChain();
      matchesForC._setResolve([
        {
          id: 'user-a',
          display_name: 'User A',
          avatar_url: null,
          native_languages: ['en'],
          target_languages: ['es'],
          is_serious_learner: true,
          study_streak_days: 30,
          correction_ratio: 0.95,
        },
      ]);

      mockFrom
        .mockReturnValueOnce(usersChain)
        .mockReturnValueOnce(matchesForA)
        .mockReturnValueOnce(matchesForB)
        .mockReturnValueOnce(matchesForC);

      await service.calculateDailyRecommendations();

      expect(mockPipeline.set).toHaveBeenCalledTimes(2);
      expect(mockPipeline.set.mock.calls[0][0]).toBe(
        'recommendations:daily:user-a',
      );
      const firstCache: RecommendedUserDto[] = JSON.parse(
        mockPipeline.set.mock.calls[0][1],
      );
      expect(firstCache).toHaveLength(1);
      expect(firstCache[0].id).toBe('user-c');
      expect(mockPipeline.set.mock.calls[1][0]).toBe(
        'recommendations:daily:user-c',
      );
    });

    it('should report a persistent Redis pipeline failure without retrying it', async () => {
      const usersChain = makeQueryChain();
      usersChain._setResolve([
        { id: 'user-a', native_languages: ['en'], target_languages: ['es'] },
      ]);

      const matchesChain = makeQueryChain();
      matchesChain._setResolve([
        {
          id: 'partner-1',
          display_name: 'Partner 1',
          avatar_url: null,
          native_languages: ['es'],
          target_languages: ['en'],
          is_serious_learner: false,
          study_streak_days: 5,
          correction_ratio: 0.7,
        },
      ]);

      mockPipeline.exec.mockRejectedValue(new Error('Redis write failed'));

      mockFrom
        .mockReturnValueOnce(usersChain)
        .mockReturnValueOnce(matchesChain);

      await expect(
        service.calculateDailyRecommendations(),
      ).resolves.toBeUndefined();

      expect(mockPipeline.set).toHaveBeenCalledTimes(1);
      expect(mockPipeline.exec).toHaveBeenCalledTimes(1);
      expect(mockCrashReportService.reportCrash).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'calculateDailyRecommendations',
          user_id: 'system',
          degraded_tier: 'none',
        }),
      );
    });

    it('should report Redis command errors returned by a pipeline', async () => {
      const usersChain = makeQueryChain();
      usersChain._setResolve([
        { id: 'user-a', native_languages: ['en'], target_languages: ['es'] },
      ]);

      const matchesChain = makeQueryChain();
      matchesChain._setResolve([
        {
          id: 'partner-1',
          display_name: 'Partner 1',
          avatar_url: null,
          native_languages: ['es'],
          target_languages: ['en'],
          is_serious_learner: false,
          study_streak_days: 5,
          correction_ratio: 0.7,
        },
      ]);

      mockPipeline.exec.mockResolvedValueOnce([
        [new Error('Redis command failed'), null],
      ]);

      mockFrom
        .mockReturnValueOnce(usersChain)
        .mockReturnValueOnce(matchesChain);

      await expect(
        service.calculateDailyRecommendations(),
      ).resolves.toBeUndefined();

      expect(mockCrashReportService.reportCrash).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'calculateDailyRecommendations',
          user_id: 'system',
          degraded_tier: 'none',
        }),
      );
    });

    it('should report daily match-query failures instead of treating them as empty results', async () => {
      const usersChain = makeQueryChain();
      usersChain._setResolve([
        { id: 'user-a', native_languages: ['en'], target_languages: ['es'] },
      ]);

      const matchesChain = makeQueryChain();
      matchesChain._setResolve(null, { message: 'Match query failed' });

      mockFrom
        .mockReturnValueOnce(usersChain)
        .mockReturnValueOnce(matchesChain);

      await expect(
        service.calculateDailyRecommendations(),
      ).resolves.toBeUndefined();

      expect(mockPipeline.set).not.toHaveBeenCalled();
      expect(mockCrashReportService.reportCrash).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'calculateDailyRecommendations',
          user_id: 'system',
          degraded_tier: 'none',
        }),
      );
    });

    it('should prefer interest tier over language exchange when both succeed', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve([{ tag: 'music' }]);

      const sharedChain = makeQueryChain();
      sharedChain._setResolve([{ user_id: 'best-match', tag: 'music' }]);

      const usersChain = makeQueryChain();
      usersChain._setResolve([
        {
          id: 'best-match',
          display_name: 'Best Match',
          avatar_url: null,
          native_languages: ['fr'],
          target_languages: ['en'],
          is_serious_learner: true,
          study_streak_days: 50,
          correction_ratio: 0.99,
        },
      ]);

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(sharedChain)
        .mockReturnValueOnce(usersChain);

      const result = await service.getRecommendationsWithFallback('user-123');
      expect(result).toHaveLength(1);
      expect(result[0].matchTier).toBe('interest');
      expect(result[0].id).toBe('best-match');
    });

    it('should skip mock data user filtering when userId not in MOCK_USERS', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve(null, { message: 'Interests offline' });

      const userChain = makeQueryChain();
      userChain._setResolve(null, { message: 'Users offline' });

      const activeChain = makeQueryChain();
      activeChain._setResolve(null, { message: 'Users offline' });

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(userChain)
        .mockReturnValueOnce(activeChain);

      const result = await service.getRecommendationsWithFallback(
        'some-completely-random-id',
      );
      expect(result.length).toBeLessThanOrEqual(20);
      expect(result.every((r) => r.id !== 'some-completely-random-id')).toBe(
        true,
      );
      expect(result.every((r) => r.matchTier === 'mock')).toBe(true);
    });
  });

  describe('purgeRecommendationsCache (GDPR erasure)', () => {
    it('should delete the user recommendation cache key from Redis', async () => {
      await service.purgeRecommendationsCache('user-to-delete');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'recommendations:daily:user-to-delete',
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Connection lost'));

      // Should not throw
      await expect(
        service.purgeRecommendationsCache('user-to-delete'),
      ).resolves.toBeUndefined();
    });
  });

  describe('tier degradation crash reporting', () => {
    it('should report crash when interest tier throws in getRecommendationsWithFallback', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve(null, {
        message: 'Interests DB connection refused',
      });

      const userChain = makeQueryChain();
      userChain._setResolve({
        id: 'user-123',
        native_language: 'en',
        target_languages: ['es'],
      });

      const matchesChain = makeQueryChain();
      matchesChain._setResolve([
        {
          id: 'lang-partner',
          display_name: 'Lang Partner',
          avatar_url: null,
          native_language: 'es',
          target_languages: ['en'],
          is_serious_learner: true,
          study_streak_days: 20,
          correction_ratio: 0.88,
        },
      ]);

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(userChain)
        .mockReturnValueOnce(matchesChain);

      await service.getRecommendationsWithFallback('user-123');

      expect(mockCrashReportService.reportCrash).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'getRecommendationsWithFallback:interest',
          user_id: 'user-123',
          degraded_tier: 'language_exchange',
          circuit_breaker_open: false,
        }),
      );
    });

    it('should report crash when all tiers fail in getRecommendationsWithFallback', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve(null, { message: 'Interests DB down' });

      const userChain = makeQueryChain();
      userChain._setResolve(null, { message: 'Users DB down' });

      const activeChain = makeQueryChain();
      activeChain._setResolve(null, { message: 'Users DB down' });

      mockFrom
        .mockReturnValueOnce(tagsChain)
        .mockReturnValueOnce(userChain)
        .mockReturnValueOnce(activeChain);

      await service.getRecommendationsWithFallback('user-123');

      // Should have reported interest and language_exchange degradations, and active_users
      expect(mockCrashReportService.reportCrash).toHaveBeenCalledTimes(3);
      expect(mockCrashReportService.reportCrash).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'getRecommendationsWithFallback:interest',
          degraded_tier: 'language_exchange',
        }),
      );
      expect(mockCrashReportService.reportCrash).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'getRecommendationsWithFallback:language_exchange',
          degraded_tier: 'active_users',
        }),
      );
      expect(mockCrashReportService.reportCrash).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'getRecommendationsWithFallback:active_users',
          degraded_tier: 'mock',
        }),
      );
    });

    it('should report crash for daily recommendation calculation failure', async () => {
      const chain = makeQueryChain();
      chain._setResolve(null, { message: 'Users table offline' });
      mockFrom.mockReturnValueOnce(chain);

      await service.calculateDailyRecommendations();

      expect(mockCrashReportService.reportCrash).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'calculateDailyRecommendations',
          user_id: 'system',
          degraded_tier: 'none',
        }),
      );
    });

    it('should report crash when daily Redis fails and live fallback also fails', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection refused'));

      const userChain = makeQueryChain();
      userChain._setResolve(null, { message: 'Users table offline' });

      mockFrom.mockReturnValueOnce(userChain);

      const result = await service.getDailyRecommendations('user-123');
      expect(result).toEqual([]);

      expect(mockCrashReportService.reportCrash).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'getDailyRecommendations:redis',
          degraded_tier: 'language_exchange_live',
        }),
      );
      expect(mockCrashReportService.reportCrash).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'getDailyRecommendations:live',
          degraded_tier: 'empty',
        }),
      );
    });
  });
});
