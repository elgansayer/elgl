import { Test, TestingModule } from '@nestjs/testing';
import { DataRetentionService } from './data-retention.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('DataRetentionService', () => {
  let service: DataRetentionService;
  let mockSupabaseClient: Record<string, jest.Mock>;
  let mockQueryBuilder: Record<string, jest.Mock>;
  let mockRedis: { del: jest.Mock };

  beforeEach(async () => {
    mockQueryBuilder = {
      delete: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    mockRedis = {
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataRetentionService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
            getRedisClient: jest.fn().mockReturnValue(mockRedis),
          },
        },
      ],
    }).compile();

    service = module.get<DataRetentionService>(DataRetentionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('purgeLoginHistory', () => {
    it('deletes login history older than 180 days', async () => {
      mockQueryBuilder.lt.mockResolvedValue({ error: null, count: 42 });

      await service.purgeLoginHistory();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('login_history');
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.lt).toHaveBeenCalledWith(
        'created_at',
        expect.any(String),
      );
    });

    it('logs error when delete fails', async () => {
      mockQueryBuilder.lt.mockResolvedValue({
        error: { message: 'db error' },
        count: null,
      });

      // Should not throw
      await expect(service.purgeLoginHistory()).resolves.toBeUndefined();
    });
  });

  describe('purgeOldReports', () => {
    it('deletes terminal reports older than 365 days', async () => {
      mockQueryBuilder.lt.mockResolvedValue({ error: null, count: 3 });

      await service.purgeOldReports();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('reports');
      expect(mockQueryBuilder.in).toHaveBeenCalledWith('status', [
        'approved',
        'rejected',
      ]);
    });

    it('logs error when delete fails', async () => {
      mockQueryBuilder.lt.mockResolvedValue({
        error: { message: 'db error' },
        count: null,
      });

      await expect(service.purgeOldReports()).resolves.toBeUndefined();
    });
  });

  describe('finaliseAccountDeletions', () => {
    it('does nothing when no users are pending deletion', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: [], error: null });

      await service.finaliseAccountDeletions();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      // Should not attempt to wipe data
    });

    it('anonymises users past their deletion grace period', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: [{ id: 'user-abc-123' }],
        error: null,
      });
      // Setup sub-queries for data wiping
      const mockDeleteBuilder = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      // Override from for subsequent calls within wipeUserData
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') {
          // First call is for select (limit), second is for update (eq)
          return mockQueryBuilder;
        }
        return mockDeleteBuilder;
      });

      await service.finaliseAccountDeletions();

      expect(mockQueryBuilder.select).toHaveBeenCalledWith('id');
      expect(mockQueryBuilder.update).toHaveBeenCalled();
    });

    it('wipes coin-economy tables for deleted users', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: [{ id: 'user-abc-123' }],
        error: null,
      });
      const mockDeleteBuilder = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      const calledTables: string[] = [];
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return mockQueryBuilder;
        }
        calledTables.push(table);
        return mockDeleteBuilder;
      });

      await service.finaliseAccountDeletions();

      // Verify economy tables are included in the wipe
      expect(calledTables).toContain('coin_purchases');
      expect(calledTables).toContain('gift_transactions');
      expect(calledTables).toContain('user_sticker_packs');
      expect(calledTables).toContain('user_statistics');
    });

    it('purges Redis recommendation cache during account deletion', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: [{ id: 'user-abc-123' }],
        error: null,
      });
      const mockDeleteBuilder = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return mockQueryBuilder;
        }
        return mockDeleteBuilder;
      });

      await service.finaliseAccountDeletions();

      // Verify the recommendation cache was purged (GDPR erasure)
      expect(mockRedis.del).toHaveBeenCalledWith(
        'recommendations:daily:user-abc-123',
      );
    });

    it('handles error when querying users to delete', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: null,
        error: { message: 'query error' },
      });

      await expect(
        service.finaliseAccountDeletions(),
      ).resolves.toBeUndefined();
    });
  });
});