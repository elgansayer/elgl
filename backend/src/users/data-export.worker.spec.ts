import { Test, TestingModule } from '@nestjs/testing';
import { DataExportWorker } from './data-export.worker';
import { SupabaseService } from '../supabase/supabase.service';

describe('DataExportWorker', () => {
  let worker: DataExportWorker;
  let mockSupabaseClient: Record<string, unknown>;
  let mockQueryBuilder: Record<string, unknown>;

  beforeEach(async () => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataExportWorker,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
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
      const fromMock = mockSupabaseClient.from as jest.Mock;
      fromMock.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest
              .fn()
              .mockResolvedValue({ data: mockProfile, error: null }),
          };
        }
        if (table === 'decks') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: mockDecks, error: null }),
          };
        }
        if (table === 'deck_flashcards') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest
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
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
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

    it('should handle profile fetch error and throw', async () => {
      const fromMock = mockSupabaseClient.from as jest.Mock;
      fromMock.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      }));

      await expect(worker.exportUserData('user-1')).rejects.toThrow(
        'Failed to fetch profile: Database error',
      );
    });
  });
});
