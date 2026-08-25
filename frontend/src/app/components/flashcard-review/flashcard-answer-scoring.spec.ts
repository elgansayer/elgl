import { describe, expect, it } from 'vitest';
import { scoreFlashcardAnswer } from './flashcard-answer-scoring';

describe('scoreFlashcardAnswer', () => {
  it('awards full credit after Unicode, case, whitespace and punctuation normalization', () => {
    expect(scoreFlashcardAnswer('Good morning!', '  GOOD   MORNING ')).toEqual({
      match: 'exact',
      score: 100,
      distance: 0,
      suggestedGrade: 'known',
    });
  });

  it('awards partial credit for a single minor typo', () => {
    const result = scoreFlashcardAnswer('abundant', 'abundnat');

    expect(result.match).toBe('partial');
    expect(result.distance).toBe(1);
    expect(result.suggestedGrade).toBe('good');
    expect(result.score).toBeGreaterThanOrEqual(85);
  });

  it('supports non-Latin answers without transliterating or splitting code units', () => {
    expect(scoreFlashcardAnswer('おはようございます', 'おはよございます')).toMatchObject({
      match: 'partial',
      distance: 1,
      suggestedGrade: 'good',
    });
  });

  it('accepts an explicitly listed translation alternative', () => {
    expect(scoreFlashcardAnswer('Really? / Is that so?', 'is that so')).toMatchObject({
      match: 'exact',
      suggestedGrade: 'known',
    });
  });

  it('does not grant partial credit when the answer differs materially', () => {
    expect(scoreFlashcardAnswer('abundant', 'scarce')).toMatchObject({
      match: 'incorrect',
      suggestedGrade: 'again',
    });
  });

  it('is deliberately strict for one- and two-character answers', () => {
    expect(scoreFlashcardAnswer('go', 'no')).toMatchObject({
      match: 'incorrect',
      suggestedGrade: 'again',
    });
  });

  it('returns unavailable for blank or pathologically long inputs rather than doing unbounded work', () => {
    expect(scoreFlashcardAnswer('answer', '   ').match).toBe('unavailable');
    expect(scoreFlashcardAnswer('a'.repeat(257), 'a'.repeat(257))).toEqual({
      match: 'unavailable',
      score: 0,
      distance: null,
      suggestedGrade: null,
    });
  });
});
