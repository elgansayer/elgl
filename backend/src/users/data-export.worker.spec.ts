import type { Mock } from 'vitest';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataExportWorker } from './data-export.worker';
import { SupabaseService } from '../supabase/supabase.service';

describe('DataExportWorker', () => {
  let worker: DataExportWorker;
  let mockSupabaseClient: Record<string, unknown>;
  let mockQueryBuilder: Record<string, unknown>;

  beforeEach(async () => {
    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataExportWorker,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    worker = module.get<DataExportWorker>(DataExportWorker);
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  describe('exportUserData', () => {
    it('should export user data from all relevant tables including decks', async () => {
      const mockProfile = { id: 'user-1', display_name: 'Test User' };
      const mockMoments = [{ id: 'moment-1', content: 'Hello world' }];
      const mockComments = [{ id: 'comment-1', text: 'Nice moment' }];
      const mockMessages = [{ id: 'msg-1', text: 'Hello' }];
      const mockFlashcards = [{ id: 'card-1', front: 'Hola', back: 'Hello' }];
      const mockDecks = [
        { id: 'deck-1', name: 'Spanish Basics', user_id: 'user-1' },
      ];
      const mockDeckFlashcards = [
        { id: 'df-1', deck_id: 'deck-1', flashcard_id: 'card-1' },
      ];
      const mockFavourites = [{ id: 'fav-1', moment_id: 'moment-1' }];

      // Table-aware mock: returns different builders based on table name
      const fromMock = mockSupabaseClient.from as Mock;
      fromMock.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: mockProfile, error: null }),
          };
        }
        if (table === 'decks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockDecks, error: null }),
          };
        }
        if (table === 'deck_flashcards') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi
              .fn()
              .mockResolvedValue({ data: mockDeckFlashcards, error: null }),
          };
        }

        // Dispatch data for moments, comments, messages, flashcards, favourites
        const tableDataMap: Record<string, unknown[]> = {
          moments: mockMoments,
          moment_comments: mockComments,
          chat_messages: mockMessages,
          flashcards: mockFlashcards,
          favourites: mockFavourites,
        };
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: tableDataMap[table] ?? [],
            error: null,
          }),
        };
      });

      const result = await worker.exportUserData('user-1');

      expect(result.profile).toEqual(mockProfile);
      expect(result.moments).toEqual(mockMoments);
      expect(result.comments).toEqual(mockComments);
      expect(result.messages).toEqual(mockMessages);
      expect(result.flashcards).toEqual(mockFlashcards);
      expect(result.decks).toEqual(mockDecks);
      expect(result.deck_flashcards).toEqual(mockDeckFlashcards);
      expect(result.favourites).toEqual(mockFavourites);
      expect(result.exported_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    /**
     * Table-aware mock that records every eq() filter. The shared mock answers
     * the same whatever column is filtered, so it cannot reject a column that
     * does not exist; the tests assert the filters directly.
     */
    function mockTables(
      options: {
        rows?: Record<string, unknown[]>;
        errors?: Record<string, { message: string }>;
      } = {},
    ): Array<{ table: string; column: string; value: unknown }> {
      const filters: Array<{ table: string; column: string; value: unknown }> =
        [];
      (mockSupabaseClient.from as Mock).mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: { id: 'user-1' }, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn((column: string, value: unknown) => {
            filters.push({ table, column, value });
            const error = options.errors?.[table] ?? null;
            return Promise.resolve({
              data: error ? null : (options.rows?.[table] ?? []),
              error,
            });
          }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });
      return filters;
    }

    it('should read Moments, comments and likes through the user_id owner column', async () => {
      const likes = [
        { id: 'like-1', moment_id: 'moment-1', user_id: 'user-1' },
      ];
      const filters = mockTables({ rows: { moment_likes: likes } });

      const result = await worker.exportUserData('user-1');

      // moments, moment_comments and moment_likes are owned through user_id
      // (005_moments.sql); there is no author_id column.
      for (const table of ['moments', 'moment_comments', 'moment_likes']) {
        expect(filters).toContainEqual({
          table,
          column: 'user_id',
          value: 'user-1',
        });
      }
      expect(filters.filter(({ column }) => column === 'author_id')).toEqual(
        [],
      );
      expect(result.moment_likes).toEqual(likes);
    });

    it.each(['moments', 'moment_comments', 'moment_likes'])(
      'should fail closed without exposing provider or user details when %s cannot be read',
      async (table) => {
        const errorLog = vi
          .spyOn(Logger.prototype, 'error')
          .mockImplementation(() => undefined);
        mockTables({ errors: { [table]: { message: 'provider detail' } } });

        await expect(worker.exportUserData('user-1')).rejects.toThrow(
          'Data export failed',
        );
        expect(JSON.stringify(errorLog.mock.calls)).not.toContain(
          'provider detail',
        );
        expect(JSON.stringify(errorLog.mock.calls)).not.toContain('user-1');
        expect(errorLog).toHaveBeenCalledWith({
          event: 'data_export_dataset_failed',
          dataset: table,
        });
      },
    );

    it('should handle profile fetch error and throw', async () => {
      const fromMock = mockSupabaseClient.from as Mock;
      fromMock.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      }));

      await expect(worker.exportUserData('user-1')).rejects.toThrow(
        'Data export failed',
      );
    });
  });
});
