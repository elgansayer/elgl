import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../supabase/supabase.service';
import { WordOfTheDayService } from './word-of-the-day.service';

describe('WordOfTheDayService', () => {
  let service: WordOfTheDayService;
  let single: Mock;

  beforeEach(async () => {
    single = vi.fn().mockResolvedValue({
      data: { target_languages: ['ja'], native_languages: ['en'] },
      error: null,
    });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single,
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordOfTheDayService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue(query),
            }),
          },
        },
      ],
    }).compile();

    service = module.get(WordOfTheDayService);
  });

  it('uses the learner primary target language', async () => {
    const result = await service.getTodayWordForUser(
      'user-1',
      new Date('2026-08-22T23:59:59.000Z'),
    );

    expect(result.languageCode).toBe('ja');
    expect(result.language).toBe('Japanese');
    expect(result.date).toBe('2026-08-22');
    expect(result.word.length).toBeGreaterThan(0);
    expect(result.example.length).toBeGreaterThan(0);
  });

  it('returns the same word for the whole UTC day', () => {
    const morning = service.getWordForDate(
      'es',
      new Date('2026-08-22T00:00:01.000Z'),
    );
    const evening = service.getWordForDate(
      'es',
      new Date('2026-08-22T23:59:59.000Z'),
    );

    expect(evening).toEqual(morning);
  });

  it('rotates to a different word on the next UTC day', () => {
    const first = service.getWordForDate(
      'fr',
      new Date('2026-08-22T12:00:00.000Z'),
    );
    const next = service.getWordForDate(
      'fr',
      new Date('2026-08-23T12:00:00.000Z'),
    );

    expect(next.word).not.toBe(first.word);
    expect(next.date).toBe('2026-08-23');
  });

  it('normalises locale-style language codes', () => {
    const result = service.getWordForDate(
      'JA-JP',
      new Date('2026-08-22T12:00:00.000Z'),
    );
    expect(result.languageCode).toBe('ja');
  });

  it('falls back to English for unsupported language catalogues', () => {
    const result = service.getWordForDate(
      'sv',
      new Date('2026-08-22T12:00:00.000Z'),
    );
    expect(result.languageCode).toBe('en');
    expect(result.language).toBe('English');
  });

  it('falls back safely when profile lookup fails', async () => {
    single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST500', message: 'sensitive provider details' },
    });

    const result = await service.getTodayWordForUser(
      'user-1',
      new Date('2026-08-22T12:00:00.000Z'),
    );

    expect(result.languageCode).toBe('en');
  });

  it('uses a native language only when no target language exists', async () => {
    single.mockResolvedValueOnce({
      data: { target_languages: [], native_languages: ['de'] },
      error: null,
    });

    const result = await service.getTodayWordForUser(
      'user-1',
      new Date('2026-08-22T12:00:00.000Z'),
    );

    expect(result.languageCode).toBe('de');
  });
});
