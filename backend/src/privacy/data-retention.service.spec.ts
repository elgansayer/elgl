import { Test, TestingModule } from '@nestjs/testing';
import { DataRetentionService } from './data-retention.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('DataRetentionService', () => {
  let service: DataRetentionService;
  let mockSupabaseClient: Record<string, jest.Mock>;
  let mockQueryBuilder: Record<string, jest.Mock>;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataRetentionService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<DataRetentionService>(DataRetentionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('purgeCallLogs', () => {
    it('deletes call logs older than 90 days', async () => {
      mockQueryBuilder.lt.mockResolvedValue({ error: null, count: 15 });

      await service.purgeCallLogs();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('call_logs');
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

      await expect(service.purgeCallLogs()).resolves.toBeUndefined();
    });
  });

  describe('purgeAudioRoomCaptions', () => {
    it('deletes captions older than 180 days', async () => {
      mockQueryBuilder.lt.mockResolvedValue({ error: null, count: 8 });
      await service.purgeAudioRoomCaptions();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('audio_room_captions');
    });
  });

  describe('purgeAudioRoomNotes', () => {
    it('deletes notes older than 180 days', async () => {
      mockQueryBuilder.lt.mockResolvedValue({ error: null, count: 5 });
      await service.purgeAudioRoomNotes();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('audio_room_notes');
    });
  });

  describe('purgeAudioRoomTranscripts', () => {
    it('deletes transcripts older than 180 days', async () => {
      mockQueryBuilder.lt.mockResolvedValue({ error: null, count: 2 });
      await service.purgeAudioRoomTranscripts();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('audio_room_transcripts');
    });
  });

  describe('purgeAudioRoomTips', () => {
    it('deletes tips older than 365 days', async () => {
      mockQueryBuilder.lt.mockResolvedValue({ error: null, count: 3 });
      await service.purgeAudioRoomTips();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('audio_room_tips');
    });
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
      const calledTables: string[] = [];
      // Override from for subsequent calls within wipeUserData
      mockSupabaseClient.from.mockImplementation((table: string) => {
        calledTables.push(table);
        if (table === 'users') {
          // First call is for select (limit), second is for update (eq)
          return mockQueryBuilder;
        }
        // audio_room_captions and audio_room_notes need update builder for anonymisation
        if (table === 'audio_room_captions' || table === 'audio_room_notes') {
          // Return a builder that supports both delete and update paths
          return {
            delete: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ error: null }),
          };
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
      // audio_room_captions and audio_room_notes need both delete and update
      const mockDeleteAndUpdateBuilder = {
        delete: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      const calledTables: string[] = [];
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return mockQueryBuilder;
        }
        calledTables.push(table);
        if (table === 'audio_room_captions' || table === 'audio_room_notes') {
          return mockDeleteAndUpdateBuilder;
        }
        return mockDeleteBuilder;
      });

      await service.finaliseAccountDeletions();

      // Verify economy tables are included in the wipe
      expect(calledTables).toContain('coin_purchases');
      expect(calledTables).toContain('gift_transactions');
      expect(calledTables).toContain('user_sticker_packs');
      expect(calledTables).toContain('user_statistics');
    });

    it('wipes video/audio classroom tables for deleted users', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: [{ id: 'user-abc-123' }],
        error: null,
      });
      const mockDeleteBuilder = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      // audio_room_captions and audio_room_notes need both delete and update
      const mockDeleteAndUpdateBuilder = {
        delete: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      const calledTables: string[] = [];
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return mockQueryBuilder;
        }
        calledTables.push(table);
        if (table === 'audio_room_captions' || table === 'audio_room_notes') {
          return mockDeleteAndUpdateBuilder;
        }
        return mockDeleteBuilder;
      });

      await service.finaliseAccountDeletions();

      // Verify video/audio classroom tables are wiped
      expect(calledTables).toContain('call_logs');
      expect(calledTables).toContain('audio_room_captions');
      expect(calledTables).toContain('audio_room_notes');
      expect(calledTables).toContain('audio_room_tips');
    });

    it('anonymises speaker_name and author_name in remaining classroom rows', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: [{ id: 'user-abc-123' }],
        error: null,
      });
      const mockDeleteBuilder = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      const captionUpdateCount: Array<{ call: number }> = [];
      const noteUpdateCount: Array<{ call: number }> = [];
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return mockQueryBuilder;
        }
        if (table === 'audio_room_captions') {
          return {
            delete: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockImplementation(() => {
              captionUpdateCount.push({ call: 1 });
              return { error: null };
            }),
          };
        }
        if (table === 'audio_room_notes') {
          return {
            delete: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockImplementation(() => {
              noteUpdateCount.push({ call: 1 });
              return { error: null };
            }),
          };
        }
        return mockDeleteBuilder;
      });

      await service.finaliseAccountDeletions();

      // Both update (anonymise) calls should have been made
      expect(captionUpdateCount.length).toBeGreaterThanOrEqual(1);
      expect(noteUpdateCount.length).toBeGreaterThanOrEqual(1);
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