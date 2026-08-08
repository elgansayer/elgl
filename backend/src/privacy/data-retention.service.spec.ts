import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataRetentionService } from './data-retention.service';
import { R2Service } from '../cloudflare-r2/r2.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('DataRetentionService', () => {
  let service: DataRetentionService;
  let mockSupabaseClient: Record<string, jest.Mock>;
  let mockQueryBuilder: Record<string, jest.Mock>;
  let mockRedis: { del: jest.Mock };
  let mockEventEmitter: { emit: jest.Mock };
  let mockR2Service: { deleteByPrefix: jest.Mock };

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
    mockEventEmitter = { emit: jest.fn() };
    mockR2Service = {
      deleteByPrefix: jest.fn().mockResolvedValue(0),
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
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: R2Service,
          useValue: mockR2Service,
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
      const mockUpdateBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      // Override from for subsequent calls within wipeUserData
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') {
          // First call is for select (limit), second is for update (eq)
          return mockQueryBuilder;
        }
        if (table === 'audio_rooms') {
          return mockUpdateBuilder;
        }
        return mockDeleteBuilder;
      });

      await service.finaliseAccountDeletions();

      expect(mockQueryBuilder.select).toHaveBeenCalledWith('id');
      expect(mockQueryBuilder.update).toHaveBeenCalled();
    });

    it('wipes coin-economy, reading-engine, and video-classroom tables for deleted users', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: [{ id: 'user-abc-123' }],
        error: null,
      });
      const mockDeleteBuilder = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      const mockUpdateBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      const calledTables: string[] = [];
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return mockQueryBuilder;
        }
        if (table === 'audio_rooms') {
          calledTables.push(table);
          return mockUpdateBuilder;
        }
        calledTables.push(table);
        return mockDeleteBuilder;
      });

      await service.finaliseAccountDeletions();

      // Verify economy tables are included in the wipe
      expect(calledTables).toContain('coin_purchases');
      expect(calledTables).toContain('gift_transactions');
      expect(calledTables).toContain('escrow_transactions');
      expect(calledTables).toContain('user_sticker_packs');
      expect(calledTables).toContain('user_statistics');
      // Verify LingQ Reading Engine tables are included
      expect(calledTables).toContain('reading_progress');
      expect(calledTables).toContain('reading_resources');
      // Verify reading-engine cache invalidation event is emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'reading.user_data_cleared',
        { userId: 'user-abc-123' },
      );
      // Verify video classroom tables are included in the wipe (GDPR Issue #2240)
      expect(calledTables).toContain('call_logs');
      expect(calledTables).toContain('audio_room_tips');
      expect(calledTables).toContain('audio_room_captions');
      expect(calledTables).toContain('poll_votes');
      expect(calledTables).toContain('quick_polls');
      expect(calledTables).toContain('audio_rooms');
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
      const mockUpdateBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return mockQueryBuilder;
        }
        if (table === 'audio_rooms') {
          return mockUpdateBuilder;
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

      await expect(service.finaliseAccountDeletions()).resolves.toBeUndefined();
    });
  });
});
