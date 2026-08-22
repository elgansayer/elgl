import { describe, expect, it } from 'vitest';
import { WordOfTheDayService } from './word-of-the-day.service';

describe('WordOfTheDayService', () => {
  const service = new WordOfTheDayService();

  it('returns a complete curated entry for a UTC day', () => {
    const result = service.getTodayWord(new Date('2026-08-22T12:00:00.000Z'));

    expect(result.date).toBe('2026-08-22');
    expect(result.word.trim()).not.toBe('');
    expect(result.translation.trim()).not.toBe('');
    expect(result.language.trim()).not.toBe('');
    expect(result.languageCode).toMatch(/^[a-z]{2}$/);
    expect(result.example.trim()).not.toBe('');
  });

  it('is stable for every instant within the same UTC day', () => {
    const first = service.getTodayWord(new Date('2026-08-22T00:00:01.000Z'));
    const last = service.getTodayWord(new Date('2026-08-22T23:59:59.999Z'));

    expect(last).toEqual(first);
  });

  it('advances the catalogue on the next UTC day', () => {
    const today = service.getTodayWord(new Date('2026-08-22T12:00:00.000Z'));
    const tomorrow = service.getTodayWord(new Date('2026-08-23T12:00:00.000Z'));

    expect(tomorrow.date).toBe('2026-08-23');
    expect(tomorrow.word).not.toBe(today.word);
  });

  it('does not return the former hard-coded mock response for every day', () => {
    const results = Array.from({ length: 7 }, (_, offset) =>
      service.getTodayWord(new Date(Date.UTC(2026, 7, 22 + offset))),
    );
    const uniqueEntries = new Set(
      results.map((entry) => `${entry.languageCode}:${entry.word}`),
    );

    expect(uniqueEntries.size).toBe(7);
  });

  it('rejects invalid dates instead of fabricating content', () => {
    expect(() => service.getTodayWord(new Date(Number.NaN))).toThrow(TypeError);
  });
});
