import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SuggestFlashcardsService } from './suggest-flashcards.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ConfigService } from '@nestjs/config';

interface MockLogger {
  info: Mock;
  error: Mock;
  warn: Mock;
  debug: Mock;
}

interface MockQueryBuilder {
  select: Mock;
  eq: Mock;
  then?: Mock;
}

interface MockSupabaseClient {
  from: Mock;
}

describe('SuggestFlashcardsService', () => {
  let service: SuggestFlashcardsService;
  let mockSupabaseClient: MockSupabaseClient;
  let mockQueryBuilder: MockQueryBuilder;
  let mockLogger: MockLogger;

  beforeEach(async () => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuggestFlashcardsService,
        {
          provide: 'PinoLogger:SuggestFlashcardsService',
          useValue: mockLogger,
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue('mock-value'),
          },
        },
      ],
    }).compile();

    service = module.get<SuggestFlashcardsService>(SuggestFlashcardsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('suggestFromMessage', () => {
    it('should tokenise a message and return unique word suggestions', async () => {
      const result = await service.suggestFromMessage({
        message: 'Hello world, hello there!',
      });

      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.suggestions.length).toBeGreaterThan(0);
      // Should contain unique word-like tokens (lowercased)
      expect(result.suggestions).toContain('hello');
      expect(result.suggestions).toContain('world');
      expect(result.suggestions).toContain('there');
      // Duplicate "hello" should be deduplicated
      expect(result.suggestions.filter((s) => s === 'hello').length).toBe(1);
    });

    it('should filter out non-word segments like punctuation', async () => {
      const result = await service.suggestFromMessage({
        message: 'Bonjour! Comment ça va?',
        target_language: 'fr',
      });

      expect(result.suggestions).toContain('bonjour');
      expect(result.suggestions).toContain('comment');
      expect(result.suggestions).toContain('ça');
      expect(result.suggestions).toContain('va');
      // Should not contain punctuation
      expect(
        result.suggestions.some((s) => s.includes('!') || s.includes('?')),
      ).toBe(false);
    });

    it('should handle empty messages returning an empty suggestions array', async () => {
      const result = await service.suggestFromMessage({
        message: '',
      });

      expect(result.suggestions).toEqual([]);
    });

    it('should handle messages with only punctuation', async () => {
      const result = await service.suggestFromMessage({
        message: '! ? ... ,',
      });

      expect(result.suggestions).toEqual([]);
    });

    it('should exclude known words when user_id is provided and exclude_known is not false', async () => {
      mockQueryBuilder.eq.mockReturnThis();
      mockQueryBuilder.then = (
        resolve: (value: { data: unknown[]; error: null }) => void,
      ) =>
        resolve({
          data: [{ word_token: 'hello' }, { word_token: 'world' }],
          error: null,
        });

      const result = await service.suggestFromMessage({
        message: 'Hello world, this is new!',
        user_id: 'user-1',
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('flashcards');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('word_token');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('srs_level', 4);
      // Known words should be excluded
      expect(result.suggestions).not.toContain('hello');
      expect(result.suggestions).not.toContain('world');
      // New words should appear
      expect(result.suggestions).toContain('this');
      expect(result.suggestions).toContain('is');
      expect(result.suggestions).toContain('new');
    });

    it('should not exclude known words when exclude_known is explicitly false', async () => {
      const result = await service.suggestFromMessage({
        message: 'Hello world!',
        user_id: 'user-1',
        exclude_known: false,
      });

      // Should not query for known words
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
      expect(result.suggestions).toContain('hello');
      expect(result.suggestions).toContain('world');
    });

    it('should not query known words when user_id is missing', async () => {
      const result = await service.suggestFromMessage({
        message: 'Hello world!',
      });

      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
      expect(result.suggestions).toContain('hello');
      expect(result.suggestions).toContain('world');
    });

    it('should handle known words query returning null data gracefully', async () => {
      mockQueryBuilder.eq.mockReturnThis();
      mockQueryBuilder.then = (
        resolve: (value: { data: null; error: null }) => void,
      ) => resolve({ data: null, error: null });

      const result = await service.suggestFromMessage({
        message: 'Hello world!',
        user_id: 'user-1',
      });

      expect(result.suggestions).toContain('hello');
      expect(result.suggestions).toContain('world');
    });

    it('should handle Chinese text using Intl.Segmenter', async () => {
      const result = await service.suggestFromMessage({
        message: '你好世界，你好！',
        target_language: 'zh',
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions).toContain('你好');
      expect(result.suggestions).toContain('世界');
    });

    it('should handle Japanese text using Intl.Segmenter', async () => {
      const result = await service.suggestFromMessage({
        message: 'こんにちは世界',
        target_language: 'ja',
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should default to English locale when target_language is not provided', async () => {
      const result = await service.suggestFromMessage({
        message: 'The café is déjà vu',
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });
});
