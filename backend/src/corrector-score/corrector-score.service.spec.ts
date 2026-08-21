import { Test, TestingModule } from '@nestjs/testing';
import { CorrectorScoreService } from './corrector-score.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('CorrectorScoreService', () => {
  let service: CorrectorScoreService;

  const mockRatings = [{ score: 5 }, { score: 4 }, { score: 5 }];

  function setupSupabase(
    selectData: unknown,
    selectError: unknown | null = null,
    upsertError: unknown | null = null,
  ) {
    const mockEq = vi
      .fn()
      .mockReturnValue(
        Promise.resolve({ data: selectData, error: selectError }),
      );

    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    const mockUpsert = vi
      .fn()
      .mockReturnValue(Promise.resolve({ error: upsertError }));

    const mockFrom = vi.fn().mockReturnValue({
      select: mockSelect,
      upsert: mockUpsert,
    });

    const mockClient = { from: mockFrom };

    return { mockClient, mockFrom, mockSelect, mockEq, mockUpsert };
  }

  async function createService(
    mockClient: ReturnType<typeof setupSupabase>['mockClient'],
  ) {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CorrectorScoreService,
        {
          provide: SupabaseService,
          useValue: { getClient: vi.fn().mockReturnValue(mockClient) },
        },
      ],
    }).compile();

    return moduleRef.get<CorrectorScoreService>(CorrectorScoreService);
  }

  it('should be defined', async () => {
    const { mockClient } = setupSupabase([]);
    service = await createService(mockClient);
    expect(service).toBeDefined();
  });

  describe('submitRating', () => {
    it('should upsert a rating into corrector_ratings', async () => {
      const { mockClient, mockFrom, mockUpsert } = setupSupabase(
        [],
        null,
        null,
      );
      service = await createService(mockClient);

      await service.submitRating('rater-1', 'rated-1', 4);

      expect(mockFrom).toHaveBeenCalledWith('corrector_ratings');
      expect(mockUpsert).toHaveBeenCalledWith(
        { rater_id: 'rater-1', rated_user_id: 'rated-1', score: 4 },
        { onConflict: 'rater_id,rated_user_id' },
      );
    });

    it('should throw if supabase returns an upsert error', async () => {
      const { mockClient } = setupSupabase([], null, { message: 'DB error' });
      service = await createService(mockClient);

      await expect(
        service.submitRating('rater-1', 'rated-1', 5),
      ).rejects.toEqual({ message: 'DB error' });
    });
  });

  describe('getCorrectorScore', () => {
    it('should compute average score from ratings', async () => {
      const { mockClient, mockFrom, mockEq } = setupSupabase(mockRatings, null);
      service = await createService(mockClient);

      const result = await service.getCorrectorScore('user-1');

      expect(mockFrom).toHaveBeenCalledWith('corrector_ratings');
      expect(mockEq).toHaveBeenCalledWith('rated_user_id', 'user-1');
      expect(result.totalRatings).toBe(3);
      // (5+4+5)/3 = 4.666..., rounded to 1 decimal = 4.7
      expect(result.averageScore).toBe(4.7);
    });

    it('should return null averageScore and zero totalRatings when no ratings exist', async () => {
      const { mockClient } = setupSupabase([], null);
      service = await createService(mockClient);

      const result = await service.getCorrectorScore('user-1');

      expect(result.averageScore).toBeNull();
      expect(result.totalRatings).toBe(0);
    });

    it('should handle null data gracefully', async () => {
      const { mockClient } = setupSupabase(null, null);
      service = await createService(mockClient);

      const result = await service.getCorrectorScore('user-1');

      expect(result.averageScore).toBeNull();
      expect(result.totalRatings).toBe(0);
    });

    it('should throw if supabase returns a select error', async () => {
      const { mockClient } = setupSupabase(null, { message: 'DB error' });
      service = await createService(mockClient);

      await expect(service.getCorrectorScore('user-1')).rejects.toEqual({
        message: 'DB error',
      });
    });

    it('should round average score to 1 decimal place', async () => {
      // 4.25 should round to 4.3
      const ratings = [{ score: 4 }, { score: 5 }, { score: 4 }, { score: 4 }];
      const { mockClient } = setupSupabase(ratings, null);
      service = await createService(mockClient);

      const result = await service.getCorrectorScore('user-1');

      expect(result.totalRatings).toBe(4);
      expect(result.averageScore).toBe(4.3);
    });
  });
});
