import { Test, TestingModule } from '@nestjs/testing';
import { UserInterestsService } from './user-interests.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('UserInterestsService', () => {
  let service: UserInterestsService;
  let mockSupabase: any;
  let mockRedis: any;

  beforeEach(async () => {
    mockSupabase = {
      from: vi.fn(),
    };

    mockRedis = {
      del: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserInterestsService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => mockSupabase,
            getRedisClient: () => mockRedis,
          },
        },
      ],
    }).compile();

    service = module.get<UserInterestsService>(UserInterestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserInterests', () => {
    it('should retrieve tags', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        returns: vi
          .fn()
          .mockResolvedValue({ data: [{ tag: 'music' }], error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await service.getUserInterests('user-1');
      expect(result).toEqual(['music']);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_interests');
    });

    it('should throw on error', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        returns: vi
          .fn()
          .mockResolvedValue({ data: null, error: new Error('db error') }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await expect(service.getUserInterests('user-1')).rejects.toThrow(
        'db error',
      );
    });
  });

  describe('updateUserInterests', () => {
    it('should clear and insert tags and invalidate cache', async () => {
      const mockDelete = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      const mockInsert = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'user_interests') {
          // This mock is a bit simplistic since we call .from twice,
          // but we can distinguish by what happens next
          return {
            ...mockDelete,
            ...mockInsert,
          };
        }
      });

      await service.updateUserInterests('user-1', ['music', 'travel']);

      expect(mockSupabase.from).toHaveBeenCalledWith('user_interests');
      expect(mockRedis.del).toHaveBeenCalledWith(
        'daily_recommendations:user-1',
        'recommendations:daily:user-1',
      );
    });
  });

  describe('getVocabularyForInterests', () => {
    it('should retrieve vocabulary entries', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        returns: vi.fn().mockResolvedValue({
          data: [
            {
              interest_tag: 'music',
              vocab_word: 'guitar',
              translation: 'guitare',
              srs_level: 0,
            },
          ],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await service.getVocabularyForInterests(['music'], 'fr');
      expect(result).toEqual([
        {
          interestTag: 'music',
          vocabWord: 'guitar',
          translation: 'guitare',
          srsLevel: 0,
        },
      ]);
    });
  });
});
