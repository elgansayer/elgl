import type { Mock, MockInstance } from 'vitest';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../supabase/supabase.service';
import {
  WORD_OF_THE_DAY_LANGUAGE_CODES,
  WordOfTheDayService,
} from './word-of-the-day.service';

const DAY_MS = 86_400_000;

describe('WordOfTheDayService', () => {
  let service: WordOfTheDayService;
  let single: Mock;
  let select: Mock;
  let eq: Mock;
  let getClient: Mock;
  let warn: MockInstance;

  beforeEach(async () => {
    single = vi.fn().mockResolvedValue({
      data: { target_languages: ['ja'], native_languages: ['en'] },
      error: null,
    });
    select = vi.fn().mockReturnThis();
    eq = vi.fn().mockReturnThis();
    const query = { select, eq, single };
    getClient = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue(query),
    });
    warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordOfTheDayService,
        { provide: SupabaseService, useValue: { getClient } },
      ],
    }).compile();

    service = module.get(WordOfTheDayService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('reads only the language preferences of the authenticated learner', async () => {
    await service.getTodayWordForUser(
      'user-1',
      new Date('2026-08-22T12:00:00.000Z'),
    );

    expect(select).toHaveBeenCalledWith('target_languages, native_languages');
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
    expect(eq).toHaveBeenCalledTimes(1);
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

  it('rolls over exactly at UTC midnight regardless of the learner time zone', () => {
    const lastSecond = service.getWordForDate(
      'de',
      new Date('2026-08-22T23:59:59.999Z'),
    );
    const firstSecond = service.getWordForDate(
      'de',
      new Date('2026-08-23T00:00:00.000Z'),
    );

    expect(lastSecond.date).toBe('2026-08-22');
    expect(firstSecond.date).toBe('2026-08-23');
    expect(firstSecond.word).not.toBe(lastSecond.word);
  });

  it('normalises locale-style language codes', () => {
    const result = service.getWordForDate(
      'JA-JP',
      new Date('2026-08-22T12:00:00.000Z'),
    );
    expect(result.languageCode).toBe('ja');
  });

  it.each([
    ['pt_BR', 'pt'],
    ['zh-Hant-TW', 'zh'],
    ['  Es  ', 'es'],
    ['jp', 'ja'],
  ])('normalises %s to the %s catalogue', (requested, expected) => {
    const result = service.getWordForDate(
      requested,
      new Date('2026-08-22T12:00:00.000Z'),
    );
    expect(result.languageCode).toBe(expected);
  });

  it.each([[''], ['   '], ['-US']])(
    'falls back to English for a blank language code (%j)',
    (requested) => {
      const result = service.getWordForDate(
        requested,
        new Date('2026-08-22T12:00:00.000Z'),
      );
      expect(result.languageCode).toBe('en');
    },
  );

  it.each(['sv', '__proto__', 'constructor', 'toString'])(
    'falls back to English for unsupported catalogue key %s',
    (requested) => {
      const result = service.getWordForDate(
        requested,
        new Date('2026-08-22T12:00:00.000Z'),
      );
      expect(result.languageCode).toBe('en');
      expect(result.language).toBe('English');
    },
  );

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
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = String(warn.mock.calls[0][0]);
    expect(logged).toContain('PGRST500');
    expect(logged).not.toContain('sensitive provider details');
    expect(logged).not.toContain('user-1');
  });

  it('falls back safely when the data provider throws, logging only the error class', async () => {
    class ProviderOutage extends Error {
      constructor() {
        super('connection string postgres://secret@host leaked');
        this.name = 'ProviderOutage';
      }
    }
    getClient.mockImplementationOnce(() => {
      throw new ProviderOutage();
    });

    const result = await service.getTodayWordForUser(
      'user-1',
      new Date('2026-08-22T12:00:00.000Z'),
    );

    expect(result.languageCode).toBe('en');
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = String(warn.mock.calls[0][0]);
    expect(logged).toContain('ProviderOutage');
    expect(logged).not.toContain('secret');
    expect(logged).not.toContain('user-1');
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

  it.each([
    ['a missing profile row', null],
    ['an empty profile row', {}],
    [
      'non-array language columns',
      { target_languages: 'ja', native_languages: 7 },
    ],
    ['blank and non-string entries only', { target_languages: ['', 4, null] }],
  ])('defaults to English for %s', async (_label, data) => {
    single.mockResolvedValueOnce({ data, error: null });

    const result = await service.getTodayWordForUser(
      'user-1',
      new Date('2026-08-22T12:00:00.000Z'),
    );

    expect(result.languageCode).toBe('en');
    expect(warn).not.toHaveBeenCalled();
  });

  it('skips blank and non-string target entries before consulting native languages', async () => {
    single.mockResolvedValueOnce({
      data: { target_languages: ['', null, 'ko'], native_languages: ['es'] },
      error: null,
    });

    const result = await service.getTodayWordForUser(
      'user-1',
      new Date('2026-08-22T12:00:00.000Z'),
    );

    expect(result.languageCode).toBe('ko');
  });

  describe('reviewed catalogues', () => {
    const start = Date.UTC(2026, 0, 1);
    const days = (count: number): Date[] =>
      Array.from(
        { length: count },
        (_value, index) => new Date(start + index * DAY_MS),
      );

    it('covers the documented launch languages', () => {
      expect([...WORD_OF_THE_DAY_LANGUAGE_CODES].sort()).toEqual(
        ['de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pt', 'zh'].sort(),
      );
    });

    it.each(WORD_OF_THE_DAY_LANGUAGE_CODES)(
      '%s serves complete, trimmed entries labelled with its own code',
      (code) => {
        for (const day of days(30)) {
          const entry = service.getWordForDate(code, day);

          expect(entry.languageCode).toBe(code);
          for (const field of [
            entry.word,
            entry.translation,
            entry.example,
            entry.language,
          ]) {
            expect(field.length).toBeGreaterThan(0);
            expect(field).toBe(field.trim());
          }
        }
      },
    );

    it.each(WORD_OF_THE_DAY_LANGUAGE_CODES)(
      '%s never repeats a word within any seven consecutive days',
      (code) => {
        const words = days(60).map(
          (day) => service.getWordForDate(code, day).word,
        );

        for (let index = 0; index + 7 <= words.length; index += 1) {
          expect(new Set(words.slice(index, index + 7)).size).toBe(7);
        }
      },
    );

    it('is deterministic across service instances for the same language and day', async () => {
      const second = (
        await Test.createTestingModule({
          providers: [
            WordOfTheDayService,
            { provide: SupabaseService, useValue: { getClient } },
          ],
        }).compile()
      ).get(WordOfTheDayService);

      for (const code of WORD_OF_THE_DAY_LANGUAGE_CODES) {
        const day = new Date('2026-08-22T09:30:00.000Z');
        expect(second.getWordForDate(code, day)).toEqual(
          service.getWordForDate(code, day),
        );
      }
    });
  });
});
