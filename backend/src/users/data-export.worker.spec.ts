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
    it('should export user data from all relevant tables', async () => {
      const mockProfile = { id: 'user-1', display_name: 'Test User' };
      const mockMoments = [{ id: 'moment-1', content: 'Hello world' }];
      const mockComments = [{ id: 'comment-1', text: 'Nice moment' }];
      const mockMessages = [{ id: 'msg-1', text: 'Hello' }];
      const mockFlashcards = [{ id: 'card-1', front: 'Hola', back: 'Hello' }];
      const mockFavourites = [{ id: 'fav-1', moment_id: 'moment-1' }];

      (mockQueryBuilder.single as jest.Mock).mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      // The other queries return data + error = null
      const fromMock = mockSupabaseClient.from as jest.Mock;
      let callIndex = 0;
      fromMock.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          // users table - single
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest
              .fn()
              .mockResolvedValue({ data: mockProfile, error: null }),
          };
        }
        const tableData = [
          { data: mockMoments, error: null },
          { data: mockComments, error: null },
          { data: mockMessages, error: null },
          { data: mockFlashcards, error: null },
          { data: mockFavourites, error: null },
        ][callIndex - 2];
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue(tableData),
        };
      });

      const result = await worker.exportUserData('user-1');

      expect(result.profile).toEqual(mockProfile);
      expect(result.moments).toEqual(mockMoments);
      expect(result.comments).toEqual(mockComments);
      expect(result.messages).toEqual(mockMessages);
      expect(result.flashcards).toEqual(mockFlashcards);
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
