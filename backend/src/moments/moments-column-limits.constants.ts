/**
 * Maximum lengths of the fixed-size VARCHAR columns that the Moments API writes
 * (supabase/migrations/005_moments.sql).
 *
 * A longer value fails the insert at the database with 22001. The request DTOs
 * reject it first with a 400. Quiz answers need this most: the service ignores
 * an insert error on moment_question_answers so that a retried answer keeps the
 * first one, which means an overlong answer would otherwise be dropped without
 * any signal. moments-migration.contract.spec.ts compares every limit with the
 * migration so the two cannot drift apart.
 */

/** moments.target_language is VARCHAR(50). */
export const MOMENT_TARGET_LANGUAGE_MAX_LENGTH = 50;

/** moments.correct_answer is VARCHAR(255). */
export const MOMENT_CORRECT_ANSWER_MAX_LENGTH = 255;

/** moment_question_answers.selected_answer is VARCHAR(255). */
export const MOMENT_SELECTED_ANSWER_MAX_LENGTH = 255;
