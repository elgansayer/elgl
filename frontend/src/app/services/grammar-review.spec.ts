import { GrammarCheckResult } from './vocabulary.store';
import { GrammarReview, isGrammarReviewed, toGrammarReview } from './grammar-review';

function result(overrides: Partial<GrammarCheckResult>): GrammarCheckResult {
  return {
    original: 'I go to school yesterday.',
    corrected: 'I went to school yesterday.',
    explanation: 'Use the past tense.',
    errors_found: 1,
    ...overrides,
  };
}

describe('toGrammarReview', () => {
  it('remembers the original and the suggestion when the provider proposes new wording', () => {
    expect(toGrammarReview('I go to school yesterday.', result({}))).toEqual({
      original: 'I go to school yesterday.',
      suggestion: 'I went to school yesterday.',
    });
  });

  it('trims the suggestion before comparing it with the sent text', () => {
    expect(
      toGrammarReview('I go.', result({ corrected: '  I went.  ', errors_found: 1 }))?.suggestion,
    ).toBe('I went.');
  });

  it('returns null when the provider reports no errors', () => {
    expect(toGrammarReview('Fine.', result({ corrected: 'Fine.', errors_found: 0 }))).toBeNull();
  });

  it('returns null when the suggestion equals the text even if errors are reported', () => {
    expect(toGrammarReview('Fine.', result({ corrected: 'Fine.', errors_found: 2 }))).toBeNull();
  });

  it('returns null when errors are reported without a usable suggestion', () => {
    expect(toGrammarReview('Fine.', result({ corrected: '   ', errors_found: 1 }))).toBeNull();
  });

  it('returns null for the degraded fallback the store returns when the checker is unavailable', () => {
    expect(
      toGrammarReview(
        'Keep my wording',
        result({
          corrected: 'Keep my wording',
          explanation: 'Grammar check is currently unavailable',
          errors_found: 0,
        }),
      ),
    ).toBeNull();
  });
});

describe('isGrammarReviewed', () => {
  const review: GrammarReview = {
    original: 'I go to school yesterday.',
    suggestion: 'I went to school yesterday.',
  };

  it('is false before any suggestion has been shown', () => {
    expect(isGrammarReviewed(null, 'I go to school yesterday.')).toBe(false);
  });

  it('accepts the suggested wording', () => {
    expect(isGrammarReviewed(review, 'I went to school yesterday.')).toBe(true);
  });

  it('accepts the learner original wording so they can deliberately keep it', () => {
    expect(isGrammarReviewed(review, 'I go to school yesterday.')).toBe(true);
  });

  it('requires a fresh check once the learner edits into different wording', () => {
    expect(isGrammarReviewed(review, 'I went to the school yesterday.')).toBe(false);
  });
});
