import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SuggestFlashcardsService } from './suggest-flashcards.service';
import { SupabaseService } from '../supabase/supabase.service';

interface MockLogger {
  info: Mock;
  error: Mock;
  warn: Mock;
  debug: Mock;
}

interface MockQueryBuilder {
  select: Mock;
  eq: Mock;
  limit: Mock;
  then?: (
    resolve: (value: { data: unknown[] | null; error: unknown }) => void,
  ) => void;
}

interface MockSupabaseClient {
  from: Mock;
}

describe('SuggestFlashcardsService', () => {
  let service: SuggestFlashcardsService;
  let mockSupabaseClient: MockSupabaseClient;
  let mockQueryBuilder: MockQueryBuilder;
  let mockLogger: MockLogger;

  const setQueryResult = (data: unknown[] | null, error: unknown = null) => {
    mockQueryBuilder.then = (resolve) => resolve({ data, error });
  };

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
    setQueryResult([]);

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
      ],
    }).compile();

    service = module.get<SuggestFlashcardsService>(SuggestFlashcardsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('tokenises, lowercases and deduplicates word-like segments', async () => {
    const result = await service.suggestFromMessage('auth-user', {
      message: 'Hello world, hello there!',
      exclude_known: false,
    });

    expect(result.suggestions).toEqual(['hello', 'world', 'there']);
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('filters mastered words for the authenticated user', async () => {
    setQueryResult([{ word_token: 'hello' }, { word_token: 'world' }]);

    const result = await service.suggestFromMessage('auth-user', {
      message: 'Hello world, this is new!',
    });

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('flashcards');
    expect(mockQueryBuilder.select).toHaveBeenCalledWith('word_token');
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'auth-user');
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('srs_level', 4);
    expect(mockQueryBuilder.limit).toHaveBeenCalledWith(2000);
    expect(result.suggestions).not.toContain('hello');
    expect(result.suggestions).not.toContain('world');
    expect(result.suggestions).toEqual(
      expect.arrayContaining(['this', 'is', 'new']),
    );
  });

  it('ignores a legacy caller-controlled user_id', async () => {
    setQueryResult([]);

    await service.suggestFromMessage('authenticated-owner', {
      message: 'Private vocabulary',
      user_id: 'different-user',
    });

    expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
      'user_id',
      'authenticated-owner',
    );
    expect(mockQueryBuilder.eq).not.toHaveBeenCalledWith(
      'user_id',
      'different-user',
    );
  });

  it('does not read the flashcard library when exclude_known is false', async () => {
    const result = await service.suggestFromMessage('auth-user', {
      message: 'Hello world!',
      exclude_known: false,
    });

    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    expect(result.suggestions).toEqual(['hello', 'world']);
  });

  it('fails closed when the mastered-word lookup fails', async () => {
    setQueryResult(null, { message: 'database unavailable' });

    await expect(
      service.suggestFromMessage('auth-user', { message: 'Hello world!' }),
    ).rejects.toThrow('Flashcard suggestions are temporarily unavailable');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ failure: 'known_words_lookup_failed' }),
      expect.any(String),
    );
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: expect.anything() }),
      expect.any(String),
    );
  });

  it('returns no suggestions for punctuation-only input without querying storage', async () => {
    const result = await service.suggestFromMessage('auth-user', {
      message: '! ? ... ,',
    });

    expect(result.suggestions).toEqual([]);
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('supports Japanese segmentation', async () => {
    const result = await service.suggestFromMessage('auth-user', {
      message: 'こんにちは世界',
      target_language: 'ja',
      exclude_known: false,
    });

    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('supports Chinese segmentation', async () => {
    const result = await service.suggestFromMessage('auth-user', {
      message: '你好世界，你好！',
      target_language: 'zh',
      exclude_known: false,
    });

    expect(result.suggestions).toContain('你好');
    expect(result.suggestions).toContain('世界');
  });

  it('rejects unsupported locale tags without leaking provider errors', async () => {
    await expect(
      service.suggestFromMessage('auth-user', {
        message: 'Hello',
        target_language: 'definitely_not_a_locale',
        exclude_known: false,
      }),
    ).rejects.toThrow('Unsupported target language');
  });

  it('honours the bounded maximum result count', async () => {
    const result = await service.suggestFromMessage('auth-user', {
      message: 'one two three four five',
      exclude_known: false,
      max_results: 2,
    });

    expect(result.suggestions).toEqual(['one', 'two']);
  });
});
