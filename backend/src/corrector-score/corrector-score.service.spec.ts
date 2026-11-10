import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CorrectorScoreService } from './corrector-score.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('CorrectorScoreService', () => {
  function setupSupabase(
    rpcData: unknown,
    rpcError: unknown = null,
    upsertError: unknown = null,
  ) {
    const mockUpsert = vi.fn().mockResolvedValue({ error: upsertError });
    const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });
    const mockRpc = vi
      .fn()
      .mockResolvedValue({ data: rpcData, error: rpcError });
    const mockClient = { from: mockFrom, rpc: mockRpc };

    return { mockClient, mockFrom, mockUpsert, mockRpc };
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
    await expect(createService(mockClient)).resolves.toBeDefined();
  });

  describe('submitRating', () => {
    it('upserts one idempotent rating per rater and rated user', async () => {
      const { mockClient, mockFrom, mockUpsert } = setupSupabase(
        [],
        null,
        null,
      );
      const service = await createService(mockClient);

      await service.submitRating('rater-1', 'rated-1', 4);

      expect(mockFrom).toHaveBeenCalledWith('corrector_ratings');
      expect(mockUpsert).toHaveBeenCalledWith(
        { rater_id: 'rater-1', rated_user_id: 'rated-1', score: 4 },
        { onConflict: 'rater_id,rated_user_id' },
      );
    });

    it('fails closed without exposing a database error', async () => {
      const { mockClient } = setupSupabase([], null, { message: 'private' });
      const service = await createService(mockClient);

      await expect(
        service.submitRating('rater-1', 'rated-1', 5),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('getCorrectorScore', () => {
    it('returns the database aggregate without loading individual ratings', async () => {
      const { mockClient, mockFrom, mockRpc } = setupSupabase([
        { average_score: 4.7, total_ratings: 3 },
      ]);
      const service = await createService(mockClient);

      await expect(service.getCorrectorScore('user-1')).resolves.toEqual({
        averageScore: 4.7,
        totalRatings: 3,
      });
      expect(mockRpc).toHaveBeenCalledWith('get_corrector_score', {
        p_user_id: 'user-1',
      });
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('returns a null average and zero count when no ratings exist', async () => {
      const { mockClient } = setupSupabase([
        { average_score: null, total_ratings: 0 },
      ]);
      const service = await createService(mockClient);

      await expect(service.getCorrectorScore('user-1')).resolves.toEqual({
        averageScore: null,
        totalRatings: 0,
      });
    });

    it.each([
      null,
      [],
      [{ average_score: 6, total_ratings: 1 }],
      [{ average_score: 4.5, total_ratings: -1 }],
    ])('rejects malformed aggregate data: %j', async (data) => {
      const { mockClient } = setupSupabase(data);
      const service = await createService(mockClient);

      await expect(service.getCorrectorScore('user-1')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('fails closed when aggregation fails', async () => {
      const { mockClient } = setupSupabase(null, { message: 'private' });
      const service = await createService(mockClient);

      await expect(service.getCorrectorScore('user-1')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });
});
