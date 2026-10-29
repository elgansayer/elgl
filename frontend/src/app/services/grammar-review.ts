import type { GrammarCheckResult } from './vocabulary.store';

export const GRAMMAR_REVIEW_TOAST_MS = 8000;

export interface GrammarReview {
  readonly original: string;
  readonly suggestion: string;
}

export function toGrammarReview(text: string, result: GrammarCheckResult): GrammarReview | null {
  const suggestion = result.corrected.trim();
  if (result.errors_found > 0 && suggestion && suggestion !== text) {
    return { original: text, suggestion };
  }
  return null;
}

export function isGrammarReviewed(review: GrammarReview | null, text: string): boolean {
  return review !== null && (text === review.original || text === review.suggestion);
}
