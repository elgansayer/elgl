import { Test, TestingModule } from '@nestjs/testing';
import {
  RecommendationsService,
  RecommendedUserDto,
} from './recommendations.service';
import { SupabaseService } from '../supabase/supabase.service';

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

  const methodNames = ['select', 'eq', 'neq', 'in', 'contains', 'order', 'limit', 'single', 'maybeSingle'];
  methodNames.forEach((m) => {
    (chain as Record<string, unknown>)[m] = jest.fn().mockReturnValue(chain);
  });

  (chain as Record<string, unknown>)['then'] = (resolve: (value: unknown) => void) => {
    resolve(resolveHolder);
    return undefined;
  };

  return chain as QueryChainMock;
};

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let mockRedis: { get: jest.Mock; set: jest.Mock };
  let mockFrom: jest.Mock;

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };

    mockFrom = jest.fn();

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

      mockFrom.mockReturnValueOnce(usersChain).mockReturnValueOnce(matchesChain);

      await service.calculateDailyRecommendations();

      expect(mockRedis.set).toHaveBeenCalledTimes(1);
      expect(mockRedis.set.mock.calls[0][0]).toBe('recommendations:daily:user-a');

      const parsed: RecommendedUserDto[] = JSON.parse(mockRedis.set.mock.calls[0][1]);
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
  });

  describe('getRecommendations (interest-based)', () => {
    it('should return empty array when user has no tags', async () => {
      const chain = makeQueryChain();
      chain._setResolve([]);
      mockFrom.mockReturnValueOnce(chain);

      const result = await service.getRecommendations('user-123');
      expect(result).toEqual([]);
    });

    it('should throw on tag fetch error', async () => {
      const chain = makeQueryChain();
      chain._setResolve(null, { message: 'tags error' });
      mockFrom.mockReturnValueOnce(chain);

      await expect(service.getRecommendations('user-123')).rejects.toThrow('tags error');
    });
  });
});