import { screenModelOutput } from './untrusted-text';

export interface SessionSummaryOutput {
  summary: string;
  vocabulary: string[];
}

const SUMMARY_MAX_CHARS = 2_000;
const VOCABULARY_ITEM_MAX_CHARS = 100;
const VOCABULARY_MAX_ITEMS = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parses and screens the `{"summary": string, "vocabulary": string[]}` answer
 * that the transcript summarisers ask for. The transcript is spoken by other
 * people, so the answer is treated as untrusted too: it is shown to everyone
 * in a room and stored, which makes it a place an injected instruction could
 * publish a link or an unbounded blob.
 *
 * The summary is cleaned (links, active HTML, hidden characters) and capped.
 * A vocabulary entry must be a short single-line plain term: anything that
 * needed cleaning, is empty, multi-line or too long is dropped rather than
 * repaired, because a learner reviews these as words, not prose.
 *
 * Returns null when nothing usable is left.
 */
export function parseSessionSummary(raw: string): SessionSummaryOutput | null {
  const match = /\{[\s\S]*\}/.exec(raw);
  if (!match) return null;

  let value: unknown;
  try {
    value = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;

  const summary =
    typeof value.summary === 'string'
      ? screenModelOutput(value.summary, { maxLength: Infinity }).text.slice(
          0,
          SUMMARY_MAX_CHARS,
        )
      : '';

  const vocabulary: string[] = [];
  const entries: unknown = value.vocabulary;
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      if (typeof entry !== 'string') continue;
      const screened = screenModelOutput(entry, {
        maxLength: VOCABULARY_ITEM_MAX_CHARS,
      });
      if (
        screened.changed ||
        screened.tooLong ||
        screened.text.length === 0 ||
        screened.text.includes('\n')
      ) {
        continue;
      }
      if (!vocabulary.includes(screened.text)) vocabulary.push(screened.text);
      if (vocabulary.length === VOCABULARY_MAX_ITEMS) break;
    }
  }

  if (summary.length === 0 && vocabulary.length === 0) return null;
  return { summary, vocabulary };
}
