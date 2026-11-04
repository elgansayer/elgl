/**
 * Picks the URL a chat message should be previewed for.
 *
 * Chat text is free-form prose, so a naive `https?://\S+` match drags sentence
 * punctuation into the URL: "see https://example.com/post." would scrape
 * `/post.` and "請看https://example.com/post。謝謝" would scrape the Chinese
 * sentence tail. This helper ends a candidate at the characters people type
 * directly after a link and keeps the brackets that genuinely belong to it
 * (for example Wikipedia titles such as `/wiki/Rust_(language)`).
 *
 * It only locates and tidies a candidate. Protocol, host, port and credential
 * policy stays with `LinkPreviewService`, which re-validates every URL.
 */

/**
 * A URL cannot continue past whitespace, markup delimiters, typographic quotes
 * and the sentence punctuation of CJK (U+3000 to U+303F, fullwidth forms),
 * Arabic (comma, semicolon, question mark, full stop) and Indic (danda)
 * scripts. Those scripts rarely put a space before the punctuation.
 */
const URL_CANDIDATE =
  /https?:\/\/[^\s<>"\u0060\p{Pi}\p{Pf}\u2026\u3000-\u303f\uff00-\uffef\u060c\u061b\u061f\u06d4\u0964\u0965]+/giu;

/** ASCII sentence punctuation and emphasis markers that trail a pasted link. */
const TRAILING_PUNCTUATION = new Set(['.', ',', ';', ':', '!', '?', "'", '*']);

const CLOSING_TO_OPENING: Readonly<Record<string, string>> = {
  ')': '(',
  ']': '[',
  '}': '{',
};

/** Bounds the work done on a message stuffed with unusable `http://` tokens. */
const MAX_CANDIDATES = 10;

function countOccurrences(value: string, char: string): number {
  let count = 0;
  for (const current of value) {
    if (current === char) {
      count += 1;
    }
  }
  return count;
}

function trimTrailingPunctuation(candidate: string): string {
  let trimmed = candidate;
  let changed = true;

  while (changed && trimmed.length > 0) {
    changed = false;
    const last = trimmed.slice(-1);

    if (TRAILING_PUNCTUATION.has(last)) {
      trimmed = trimmed.slice(0, -1);
      changed = true;
      continue;
    }

    // Keep a closing bracket only when the URL opened it ("Foo_(bar)"). An
    // unbalanced one belongs to the surrounding prose: "(see https://a.test/x)".
    const opening = CLOSING_TO_OPENING[last];
    if (
      opening !== undefined &&
      countOccurrences(trimmed, last) > countOccurrences(trimmed, opening)
    ) {
      trimmed = trimmed.slice(0, -1);
      changed = true;
    }
  }

  return trimmed;
}

/**
 * Returns the first well-formed `http(s)` URL in the supplied text, or `null`
 * when the text contains none.
 */
export function extractFirstHttpUrl(text: string): string | null {
  let inspected = 0;

  for (const match of text.matchAll(URL_CANDIDATE)) {
    inspected += 1;
    const candidate = trimTrailingPunctuation(match[0]);
    if (URL.canParse(candidate)) {
      return candidate;
    }
    if (inspected >= MAX_CANDIDATES) {
      break;
    }
  }

  return null;
}
