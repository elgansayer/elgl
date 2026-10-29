import type { GrammarCheckResult } from './vocabulary.store';
import { isGrammarReviewed, toGrammarReview, type GrammarReview } from './grammar-review';

function result(overrides: Partial<GrammarCheckResult> = {}): GrammarCheckResult {
  return {
    original: 'I go yesterday.',
    corrected: 'I went yesterday.',
    explanation: 'Use the past tense.',
    errors_found: 1,
    ...overrides,
  };
}

describe('grammar review decisions', () => {
  it('remembers the original and trimmed suggestion', () => {
    expect(
      toGrammarReview('I go yesterday.', result({ corrected: '  I went yesterday.  ' })),
    ).toEqual({
      original: 'I go yesterday.',
      suggestion: 'I went yesterday.',
    });
  });

  it.each([
    result({ corrected: 'I go yesterday.', errors_found: 0 }),
    result({ corrected: 'I go yesterday.', errors_found: 2 }),
    result({ corrected: '   ', errors_found: 1 }),
  ])('does not create a review without a usable changed suggestion', (check) => {
    expect(toGrammarReview('I go yesterday.', check)).toBeNull();
  });

  it('accepts either reviewed wording and rechecks any further edit', () => {
    const review: GrammarReview = {
      original: 'I go yesterday.',
      suggestion: 'I went yesterday.',
    };

    expect(isGrammarReviewed(review, review.original)).toBe(true);
    expect(isGrammarReviewed(review, review.suggestion)).toBe(true);
    expect(isGrammarReviewed(review, 'I went there yesterday.')).toBe(false);
    expect(isGrammarReviewed(null, review.original)).toBe(false);
  });
});
