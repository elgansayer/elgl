import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataRetentionService } from './data-retention.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ClassReplaysService } from '../class-replays/class-replays.service';

describe('DataRetentionService', () => {
  let service: DataRetentionService;
  let mockSupabaseClient: Record<string, Mock>;
  let mockQueryBuilder: Record<string, Mock>;
  let mockRedis: { del: Mock };
  let mockEventEmitter: { emit: Mock };

  beforeEach(async () => {
    mockQueryBuilder = {
      delete: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    mockRedis = {
      del: vi.fn().mockResolvedValue(1),
    };
    mockEventEmitter = { emit: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataRetentionService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
            getRedisClient: vi.fn().mockReturnValue(mockRedis),
          },
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: ClassReplaysService,
          useValue: {
            deleteReplaysForUser: vi.fn().mockResolvedValue(undefined),
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
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'audio_room_captions',
      );
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
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'audio_room_transcripts',
      );
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
        delete: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      const _mockUpdateBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
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
            delete: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return mockDeleteBuilder;
      });

      await service.finaliseAccountDeletions();

      expect(mockQueryBuilder.select).toHaveBeenCalledWith('id');
      expect(mockQueryBuilder.update).toHaveBeenCalled();
    });

    it('wipes coin-economy and reading-engine tables for deleted users', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: [{ id: 'user-abc-123' }],
        error: null,
      });
      const mockDeleteBuilder = {
        delete: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      // audio_room_captions and audio_room_notes need both delete and update
      const _mockDeleteAndUpdateBuilder = {
        delete: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      const calledTables: string[] = [];
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return mockQueryBuilder;
        }
        calledTables.push(table);
        if (table === 'audio_room_captions' || table === 'audio_room_notes') {
          return mockDeleteBuilder;
        }
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
    });

    it('purges Redis recommendation cache during account deletion', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: [{ id: 'user-abc-123' }],
        error: null,
      });
      const mockDeleteBuilder = {
        delete: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
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

    it('logs error when Redis recommendation cache purge fails', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: [{ id: 'user-abc-123' }],
        error: null,
      });
      const mockDeleteBuilder = {
        delete: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return mockQueryBuilder;
        }
        return mockDeleteBuilder;
      });

      const mockError = new Error('Redis connection failed');
      mockRedis.del.mockRejectedValueOnce(mockError);

      const loggerErrorSpy = vi
        .spyOn(service['logger'], 'error')
        .mockImplementation();

      await service.finaliseAccountDeletions();

      expect(mockRedis.del).toHaveBeenCalledWith(
        'recommendations:daily:user-abc-123',
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to purge recommendation cache for user user-abc-123',
        mockError,
      );

      loggerErrorSpy.mockRestore();
    });

    it('wipes video/audio classroom tables for deleted users', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: [{ id: 'user-abc-123' }],
        error: null,
      });
      const mockDeleteBuilder = {
        delete: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      // audio_room_captions and audio_room_notes need both delete and update
      const _mockDeleteAndUpdateBuilder = {
        delete: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      const calledTables: string[] = [];
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return mockQueryBuilder;
        }
        calledTables.push(table);
        if (table === 'audio_room_captions' || table === 'audio_room_notes') {
          return mockDeleteBuilder;
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
        delete: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      const captionUpdateCount: Array<{ call: number }> = [];
      const noteUpdateCount: Array<{ call: number }> = [];
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return mockQueryBuilder;
        }
        if (table === 'audio_room_captions') {
          return {
            delete: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(() => {
              captionUpdateCount.push({ call: 1 });
              return { error: null };
            }),
          };
        }
        if (table === 'audio_room_notes') {
          return {
            delete: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(() => {
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

      await expect(service.finaliseAccountDeletions()).resolves.toBeUndefined();
    });

    describe('Moments data erasure (#1827)', () => {
      // The account row is anonymised, never deleted, so ON DELETE CASCADE from
      // public.users does not fire and every Moments table is erased by hand.
      // Children come before parents (supabase/migrations/005_moments.sql).
      const ERASURE_STEPS = [
        'moment_comment_votes.user_id',
        'moment_question_answers.user_id',
        'moment_likes.user_id',
        'moment_comments.reply_to_user_id',
        'moment_comments.user_id',
        'moments.user_id',
        'user_follows.follower_id',
        'user_follows.following_id',
      ];
      const stepsFor = (userId: string): string[] =>
        ERASURE_STEPS.map((step) => `${step}:${userId}`);

      /**
       * Table-aware mock. The shared builder answers the same whatever column is
       * deleted on, so it cannot reject a column that does not exist (there is
       * no moments.author_id). Every filtered statement is recorded as
       * `<table>.<column>:<value>` in call order, and `anonymise` marks the
       * update of the account row.
       */
      function mockErasure(
        fails: (
          table: string,
          column: string,
          userId: unknown,
        ) => boolean = () => false,
      ): string[] {
        const events: string[] = [];
        mockQueryBuilder.update.mockImplementation(() => {
          events.push('anonymise');
          return mockQueryBuilder;
        });
        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'users') {
            return mockQueryBuilder;
          }
          return {
            delete: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn((column: string, value: unknown) => {
              events.push(`${table}.${column}:${String(value)}`);
              return Promise.resolve({
                error: fails(table, column, value)
                  ? { message: 'deadlock detected' }
                  : null,
              });
            }),
          };
        });
        return events;
      }

      it('erases Moments data by user_id, children before parents, before anonymising the account', async () => {
        mockQueryBuilder.limit.mockResolvedValue({
          data: [{ id: 'user-abc-123' }],
          error: null,
        });
        const events = mockErasure();

        await service.finaliseAccountDeletions();

        expect(events.slice(0, ERASURE_STEPS.length)).toEqual(
          stepsFor('user-abc-123'),
        );
        expect(events.filter((event) => event === 'anonymise')).toHaveLength(1);
        expect(events.indexOf('anonymise')).toBeGreaterThanOrEqual(
          ERASURE_STEPS.length,
        );
        // moments and moment_comments have no author_id column.
        expect(
          events.filter((event) =>
            /^moment(?:s|_comments)\.author_id:/.test(event),
          ),
        ).toEqual([]);
      });

      it.each(ERASURE_STEPS)(
        'stops at the first failure and leaves the account pending when %s cannot be deleted',
        async (failingStep) => {
          mockQueryBuilder.limit.mockResolvedValue({
            data: [{ id: 'user-abc-123' }],
            error: null,
          });
          const [failingTable, failingColumn] = failingStep.split('.');
          const events = mockErasure(
            (table, column) =>
              table === failingTable && column === failingColumn,
          );
          const loggerErrorSpy = vi
            .spyOn(service['logger'], 'error')
            .mockImplementation(() => undefined);

          await expect(
            service.finaliseAccountDeletions(),
          ).resolves.toBeUndefined();

          // The failing statement is the last one issued: later Moments
          // statements, the rest of the wipe and the anonymisation never run.
          const failedAt = ERASURE_STEPS.indexOf(failingStep);
          expect(events).toEqual(
            stepsFor('user-abc-123').slice(0, failedAt + 1),
          );
          expect(mockQueryBuilder.update).not.toHaveBeenCalled();
          expect(mockEventEmitter.emit).not.toHaveBeenCalled();
          expect(mockRedis.del).not.toHaveBeenCalled();

          const failureStepNames: Record<string, string> = {
            'moment_comment_votes.user_id': 'comment_votes_owner',
            'moment_question_answers.user_id': 'question_answers_owner',
            'moment_likes.user_id': 'likes_owner',
            'moment_comments.reply_to_user_id': 'comments_reply_recipient',
            'moment_comments.user_id': 'comments_owner',
            'moments.user_id': 'moments_owner',
            'user_follows.follower_id': 'following_edges',
            'user_follows.following_id': 'follower_edges',
          };
          expect(loggerErrorSpy).toHaveBeenCalledWith(
            `gdpr_moments_erasure_failed step=${failureStepNames[failingStep]}`,
          );
          expect(loggerErrorSpy).toHaveBeenCalledWith(
            'gdpr_account_deletion_finalisation_failed',
          );
          expect(loggerErrorSpy).not.toHaveBeenCalledWith(
            expect.stringMatching(/user-abc-123|deadlock detected/),
          );
        },
      );

      it('repeats the erasure on the next run and then anonymises the account', async () => {
        mockQueryBuilder.limit.mockResolvedValue({
          data: [{ id: 'user-abc-123' }],
          error: null,
        });
        let outage = true;
        const events = mockErasure((table) => outage && table === 'moments');
        vi.spyOn(service['logger'], 'error').mockImplementation(
          () => undefined,
        );

        await service.finaliseAccountDeletions();
        expect(events).not.toContain('anonymise');

        outage = false;
        events.length = 0;
        await service.finaliseAccountDeletions();

        // Every statement is an idempotent delete, so the whole sequence runs
        // again from the start and the account is finalised.
        expect(events.slice(0, ERASURE_STEPS.length)).toEqual(
          stepsFor('user-abc-123'),
        );
        expect(events).toContain('anonymise');
      });

      it('keeps finalising the other accounts in the batch when one account fails', async () => {
        mockQueryBuilder.limit.mockResolvedValue({
          data: [{ id: 'user-a' }, { id: 'user-b' }],
          error: null,
        });
        mockErasure(
          (table, _column, userId) =>
            table === 'moments' && userId === 'user-a',
        );
        vi.spyOn(service['logger'], 'error').mockImplementation(
          () => undefined,
        );

        await service.finaliseAccountDeletions();

        expect(mockQueryBuilder.update).toHaveBeenCalledTimes(1);
        expect(mockQueryBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({ is_deleted: true }),
        );
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'user-b');
        expect(mockQueryBuilder.eq).not.toHaveBeenCalledWith('id', 'user-a');
      });
    });
  });

  describe('purgeInactiveReadingProgress', () => {
    it('deletes reading progress with last_read_at older than 730 days', async () => {
      mockQueryBuilder.lt.mockResolvedValue({ error: null, count: 5 });

      await service.purgeInactiveReadingProgress();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('reading_progress');
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.lt).toHaveBeenCalledWith(
        'last_read_at',
        expect.any(String),
      );
    });

    it('logs error when delete fails', async () => {
      mockQueryBuilder.lt.mockResolvedValue({
        error: { message: 'db error' },
        count: null,
      });

      await expect(
        service.purgeInactiveReadingProgress(),
      ).resolves.toBeUndefined();
    });
  });
});
