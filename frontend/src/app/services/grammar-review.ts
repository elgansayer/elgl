import { GrammarCheckResult } from './vocabulary.store';

/**
 * How long the explanation for an applied suggestion stays on screen. It is the
 * only feedback the learner gets about what changed, so it outlives the default
 * three second toast.
 */
export const GRAMMAR_REVIEW_TOAST_MS = 8000;

/**
 * The wording a learner has already been shown a grammar suggestion for.
 *
 * Submitting either the original or the suggested wording again sends it
 * without a second provider call. That makes "submit again to accept" exact,
 * keeps an advisory checker that keeps rewording from trapping a message, lets
 * the learner keep their own wording on purpose, and avoids spending a second
 * daily AI request on the same sentence.
 */
export interface GrammarReview {
  readonly original: string;
  readonly suggestion: string;
}

/**
 * Returns the review to remember when the provider proposes different wording
 * for `text`, or null when `text` can be sent as it is.
 */
export function toGrammarReview(text: string, result: GrammarCheckResult): GrammarReview | null {
  const suggestion = result.corrected.trim();
  if (result.errors_found > 0 && suggestion && suggestion !== text) {
    return { original: text, suggestion };
  }
  return null;
}

/** True when the learner has already reviewed a suggestion for exactly this wording. */
export function isGrammarReviewed(review: GrammarReview | null, text: string): boolean {
  return review !== null && (text === review.original || text === review.suggestion);
}
