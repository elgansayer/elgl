import { Test, TestingModule } from '@nestjs/testing';
import {
  RecommendationsService,
  RecommendedUserDto,
} from './recommendations.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from '../metrics/metrics.service';

type QueryChainMock = {
  select: jest.Mock;
  eq: jest.Mock;
  neq: jest.Mock;
  in: jest.Mock;
  contains: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  single: jest.Mock;
  maybeSingle: jest.Mock;
  match: jest.Mock;
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
    'in',
    'contains',
    'order',
    'limit',
    'single',
    'maybeSingle',
    'match',
  ];
  methodNames.forEach((m) => {
    (chain as Record<string, unknown>)[m] = jest.fn().mockReturnValue(chain);
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
  let mockRedis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let mockFrom: jest.Mock;
  let mockMetricsService: {
    recordMatchmakingRecommendationsGenerated: jest.Mock;
    recordMatchmakingRecommendationsPerRequest: jest.Mock;
    recordMatchmakingFallbackTierUsed: jest.Mock;
    recordMatchmakingEmptyResults: jest.Mock;
    recordMatchmakingRequestDuration: jest.Mock;
    recordMatchmakingDailyCacheMiss: jest.Mock;
    setMatchmakingTierSuccessRate: jest.Mock;
  };

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    mockFrom = jest.fn();

    mockMetricsService = {
      recordMatchmakingRecommendationsGenerated: jest.fn(),
      recordMatchmakingRecommendationsPerRequest: jest.fn(),
      recordMatchmakingFallbackTierUsed: jest.fn(),
      recordMatchmakingEmptyResults: jest.fn(),
      recordMatchmakingRequestDuration: jest.fn(),
      recordMatchmakingDailyCacheMiss: jest.fn(),
      setMatchmakingTierSuccessRate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue({
              from: mockFrom,
            }),
            getRedisClient: jest.fn().mockReturnValue(mockRedis),
          },
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<RecommendationsService>(RecommendationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
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
          native_language: 'en',
          target_languages: ['es'],
        },
      ]);

      const matchesChain = makeQueryChain();
      matchesChain._setResolve([
        {
          id: 'partner-1',
          display_name: 'Partner 1',
          avatar_url: 'http://img/1.png',
          native_language: 'es',
          target_languages: ['en'],
          is_serious_learner: true,
          study_streak_days: 30,
          correction_ratio: 0.95,
        },
        {
          id: 'partner-2',
          display_name: 'Partner 2',
          avatar_url: null,
          native_language: 'es',
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

      expect(mockRedis.set).toHaveBeenCalledTimes(1);
      expect(mockRedis.set.mock.calls[0][0]).toBe(
        'recommendations:daily:user-a',
      );

      const parsed: RecommendedUserDto[] = JSON.parse(
        mockRedis.set.mock.calls[0][1],
      );
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe('partner-1');
      expect(parsed[0].displayName).toBe('Partner 1');
      expect(parsed[1].id).toBe('partner-2');
    });

    it('should handle empty users gracefully', async () => {
      const chain = makeQueryChain();
      chain._setResolve([]);
      mockFrom.mockReturnValueOnce(chain);

      await service.calculateDailyRecommendations();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should handle Supabase error gracefully', async () => {
      const chain = makeQueryChain();
      chain._setResolve(null, { message: 'DB error' });
      mockFrom.mockReturnValueOnce(chain);

      await service.calculateDailyRecommendations();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should skip users without target languages', async () => {
      const chain = makeQueryChain();
      chain._setResolve([
        {
          id: 'user-a',
          native_language: 'en',
          target_languages: null,
        },
      ]);
      mockFrom.mockReturnValueOnce(chain);

      await service.calculateDailyRecommendations();
      expect(mockRedis.set).not.toHaveBeenCalled();
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

      const result = await service.getDailyRecommendations('user-123');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p-1');
      expect(
        mockMetricsService.recordMatchmakingRecommendationsGenerated,
      ).toHaveBeenCalledWith('cached', 'getDailyRecommendations', 1);
      expect(
        mockMetricsService.recordMatchmakingRequestDuration,
      ).toHaveBeenCalled();
    });

    it('should return empty array when nothing cached', async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await service.getDailyRecommendations('user-123');
      expect(result).toEqual([]);
      expect(
        mockMetricsService.recordMatchmakingDailyCacheMiss,
      ).toHaveBeenCalledWith('empty_cache');
      expect(
        mockMetricsService.recordMatchmakingEmptyResults,
      ).toHaveBeenCalledWith('getDailyRecommendations');
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
        native_language: 'en',
        target_languages: ['es'],
      });

      const matchesChain = makeQueryChain();
      matchesChain._setResolve([
        {
          id: 'partner-1',
          display_name: 'Partner 1',
          avatar_url: null,
          native_language: 'es',
          target_languages: ['en'],
          is_serious_learner: true,
          study_streak_days: 30,
          correction_ratio: 0.95,
        },
      ]);

      mockFrom
        .mockReturnValueOnce(userChain)
        .mockReturnValueOnce(matchesChain);

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
          native_language: 'es',
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
      expect(
        mockMetricsService.recordMatchmakingRecommendationsGenerated,
      ).toHaveBeenCalledWith('interest', 'getRecommendations', 1);
    });

    it('should fall back to language exchange when interests return empty', async () => {
      // Tier 1: tags chain returns no tags
      const tagsChain = makeQueryChain();
      tagsChain._setResolve([]);

      // Tier 2: language exchange chain
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
        native_language: 'en',
        target_languages: null,
      });

      // Tier 3: active users chain
      const activeChain = makeQueryChain();
      activeChain._setResolve([
        {
          id: 'active-user',
          display_name: 'Active User',
          avatar_url: null,
          native_language: 'fr',
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
          id: 'c-low', display_name: 'Low', avatar_url: null,
          native_language: 'es', target_languages: ['en'],
          is_serious_learner: true, study_streak_days: 100, correction_ratio: 0.9,
        },
        {
          id: 'c-high-serious', display_name: 'HighSerious', avatar_url: null,
          native_language: 'es', target_languages: ['en'],
          is_serious_learner: true, study_streak_days: 10, correction_ratio: 0.9,
        },
        {
          id: 'c-high-not-serious', display_name: 'HighNotSerious', avatar_url: null,
          native_language: 'es', target_languages: ['en'],
          is_serious_learner: false, study_streak_days: 50, correction_ratio: 0.9,
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
        id: 'user-123', native_language: 'en', target_languages: ['ja'],
      });

      const matchesChain = makeQueryChain();
      matchesChain._setResolve([]);

      const activeChain = makeQueryChain();
      activeChain._setResolve([
        {
          id: 'active-user', display_name: 'Active User', avatar_url: null,
          native_language: 'fr', target_languages: ['en'],
          is_serious_learner: true, study_streak_days: 40, correction_ratio: 0.85,
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

    it('should skip language exchange when user has no native_language', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve([]);

      const userChain = makeQueryChain();
      userChain._setResolve({
        id: 'user-123', native_language: null, target_languages: ['es', 'fr'],
      });

      const activeChain = makeQueryChain();
      activeChain._setResolve([
        {
          id: 'active-p', display_name: 'Active P', avatar_url: null,
          native_language: 'de', target_languages: ['en'],
          is_serious_learner: false, study_streak_days: 12, correction_ratio: 0.75,
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
          native_language: 'es',
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
        native_language: 'en',
        target_languages: ['es'],
      });

      const matchesChain = makeQueryChain();
      matchesChain._setResolve([
        {
          id: 'lang-p',
          display_name: 'Lang P',
          avatar_url: null,
          native_language: 'es',
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
        native_language: null,
        target_languages: null,
      });

      const activeChain = makeQueryChain();
      activeChain._setResolve([
        {
          id: 'active-u',
          display_name: 'Active U',
          avatar_url: null,
          native_language: 'de',
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

      const result = await service.getRecommendationsWithFallback('unknown-user');
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it('should fall to active users when language exchange matches query fails', async () => {
      const tagsChain = makeQueryChain();
      tagsChain._setResolve([]);

      const userChain = makeQueryChain();
      userChain._setResolve({
        id: 'user-123',
        native_language: 'en',
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
          native_language: 'de',
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
          native_language: 'pt',
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
        native_language: 'en',
        target_languages: ['es', 'fr'],
      });

      const matchesChain = makeQueryChain();
      matchesChain._setResolve([
        {
          id: 'full-partner',
          display_name: 'Full Partner',
          avatar_url: 'https://img.example/avatar.png',
          native_language: 'es',
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
});
