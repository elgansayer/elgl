import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FlashcardsService } from '../flashcards/flashcards.service';
import type { Flashcard } from '../flashcards/interfaces/flashcard.interface';
import { SupabaseService } from '../supabase/supabase.service';
import { AnkiiIntegrationService } from './ankii-integration.service';

function flashcard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: 'card-1',
    user_id: 'user-1',
    word_token: 'こんにちは',
    translation: 'hello',
    original_context: 'こんにちは\t世界',
    definition: 'a greeting\nused during the day',
    srs_level: 2,
    easiness_factor: 2.5,
    repetitions: 2,
    interval_days: 6,
    next_review_at: '2026-08-30T00:00:00.000Z',
    created_at: '2026-08-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('AnkiiIntegrationService', () => {
  const getFlashcards = vi.fn();
  const upsert = vi.fn();
  let service: AnkiiIntegrationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AnkiiIntegrationService(
      { getFlashcards } as unknown as FlashcardsService,
      {
        getClient: () => ({
          from: vi.fn().mockReturnValue({ upsert }),
        }),
      } as unknown as SupabaseService,
    );
  });

  it('exports multilingual flashcards as Anki-compatible TSV', async () => {
    getFlashcards.mockResolvedValue([flashcard()]);

    const result = await service.exportUserFlashcards('user-1');

    expect(getFlashcards).toHaveBeenCalledWith('user-1', undefined, 200, 0);
    expect(result).toEqual(
      expect.objectContaining({ exported: 1, truncated: false }),
    );
    expect(result.content).toContain('#separator:tab');
    expect(result.content).toContain('#columns:Front\tBack\tContext\tDefinition');
    expect(result.content).toContain(
      'こんにちは\thello\tこんにちは 世界\ta greeting used during the day',
    );
  });

  it('imports valid cards while reporting malformed and duplicate rows', async () => {
    upsert.mockResolvedValue({ error: null });
    const content = [
      '#separator:tab',
      'Front\tBack\tContext\tDefinition',
      'Bonjour\tHello\tBonjour, Marie.\tA greeting',
      'broken-row',
      'bonjour\tHi again',
      'ありがとう\tThank you',
    ].join('\n');

    const result = await service.importTsv('user-1', content);

    expect(upsert).toHaveBeenCalledWith(
      [
        {
          user_id: 'user-1',
          word_token: 'bonjour',
          translation: 'Hello',
          original_context: 'Bonjour, Marie.',
          definition: 'A greeting',
        },
        {
          user_id: 'user-1',
          word_token: 'ありがとう',
          translation: 'Thank you',
          original_context: null,
          definition: null,
        },
      ],
      { onConflict: 'user_id, word_token' },
    );
    expect(result).toEqual({
      imported: 2,
      skipped: 2,
      errors: [
        { line: 4, reason: 'Expected 2 to 4 tab-separated columns' },
        { line: 5, reason: 'Duplicate Front value in import' },
      ],
    });
  });

  it('rejects imports above the bounded card limit', async () => {
    const content = Array.from(
      { length: 501 },
      (_, index) => `word-${index}\ttranslation-${index}`,
    ).join('\n');

    await expect(service.importTsv('user-1', content)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it('fails closed when flashcard storage rejects an import', async () => {
    upsert.mockResolvedValue({ error: { message: 'database unavailable' } });

    await expect(
      service.importTsv('user-1', 'bonjour\thello'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});