import { isPrivateIp } from './ip-guard';

/** Longest URL the scraper accepts, whether typed by a user or found in a redirect. */
export const MAX_LINK_PREVIEW_URL_LENGTH = 2_048;

export type UnsafeLinkPreviewUrlReason =
  | 'too_long'
  | 'malformed'
  | 'protocol'
  | 'credentials'
  | 'port'
  | 'private_host';

/**
 * Raised when a URL must not be fetched. The same policy guards the URL a user
 * submits, every redirect hop the origin answers with, and preview image URLs,
 * so a public page cannot bounce the scraper onto an internal address.
 */
export class UnsafeLinkPreviewUrlError extends Error {
  constructor(
    readonly reason: UnsafeLinkPreviewUrlReason,
    message: string,
  ) {
    super(message);
    this.name = 'UnsafeLinkPreviewUrlError';
  }
}

/** Host suffixes that only ever resolve on private or local networks. */
const NON_PUBLIC_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.localdomain',
  '.internal',
  '.intranet',
  '.corp',
  '.lan',
  '.home.arpa',
] as const;

function isNonPublicHostname(hostname: string): boolean {
  const normalised = hostname
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/\.$/, '');

  if (normalised === 'localhost' || isPrivateIp(normalised)) {
    return true;
  }
  if (NON_PUBLIC_HOST_SUFFIXES.some((suffix) => normalised.endsWith(suffix))) {
    return true;
  }
  // A dotless name is an internal service alias (for example a container name),
  // never a public web host. IPv6 literals contain colons and are handled above.
  return !normalised.includes('.') && !normalised.includes(':');
}

/**
 * Throws when a parsed URL is not an ordinary public http(s) destination:
 * other schemes, embedded credentials, non-default ports and hosts that are
 * literally private, loopback, link-local or otherwise non-public.
 *
 * Hostnames that merely resolve to a private address are stopped later by the
 * guarded DNS lookup on the HTTP agents, which sees the address actually used.
 */
export function assertPublicHttpUrl(url: URL): void {
  const protocol = url.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new UnsafeLinkPreviewUrlError(
      'protocol',
      'Only http and https protocols are allowed',
    );
  }

  if (url.username || url.password) {
    throw new UnsafeLinkPreviewUrlError(
      'credentials',
      'Embedded credentials are not allowed',
    );
  }

  if (url.port) {
    const isDefaultPort =
      (protocol === 'http:' && url.port === '80') ||
      (protocol === 'https:' && url.port === '443');
    if (!isDefaultPort) {
      throw new UnsafeLinkPreviewUrlError(
        'port',
        'Custom ports are not allowed',
      );
    }
  }

  if (isNonPublicHostname(url.hostname)) {
    throw new UnsafeLinkPreviewUrlError(
      'private_host',
      'Private network URLs are not allowed',
    );
  }
}

/** Parses untrusted text into a URL that satisfies {@link assertPublicHttpUrl}. */
export function parseLinkPreviewUrl(raw: string): URL {
  if (raw.length > MAX_LINK_PREVIEW_URL_LENGTH) {
    throw new UnsafeLinkPreviewUrlError('too_long', 'URL is too long');
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new UnsafeLinkPreviewUrlError('malformed', 'Malformed URL');
  }

  assertPublicHttpUrl(parsed);
  return parsed;
}

/**
 * Validates the destination of a redirect before the next hop is requested.
 * The guarded DNS lookup cannot see a redirect to an IP literal (there is no
 * lookup to intercept), so each hop is checked against the same URL policy
 * as the URL the user submitted. `href` is untrusted response data.
 */
export function assertPublicRedirectTarget(href: unknown): void {
  if (typeof href !== 'string') {
    throw new UnsafeLinkPreviewUrlError('malformed', 'Malformed URL');
  }
  parseLinkPreviewUrl(href);
}

/** The normalised form of a URL, or null when it cannot be parsed. */
export function canonicalLinkPreviewUrl(raw: string): string | null {
  try {
    return new URL(raw).href;
  } catch {
    return null;
  }
}

const URL_START = /https?:\/\//iu;
/**
 * Characters that end a URL inside running text: whitespace, angle brackets,
 * double quotes, and CJK or full-width punctuation that language learners type
 * straight after a link (for example a full stop or a closing bracket).
 */
const URL_TERMINATOR =
  /[\s<>"\u{3000}-\u{303f}\u{ff01}-\u{ff0f}\u{ff1a}-\u{ff20}\u{ff3b}-\u{ff40}\u{ff5b}-\u{ff65}]/u;
const TRAILING_PUNCTUATION: ReadonlySet<string> = new Set([
  '.',
  ',',
  ';',
  ':',
  '!',
  '?',
  "'",
]);
const BRACKET_OPENERS: ReadonlyMap<string, string> = new Map([
  [')', '('],
  [']', '['],
  ['}', '{'],
]);
const BRACKETS: ReadonlySet<string> = new Set(['(', ')', '[', ']', '{', '}']);

/**
 * Returns the first http(s) URL in a chat message, without the sentence
 * punctuation or unbalanced closing bracket that usually follows a pasted
 * link. Balanced brackets stay, so `.../Foo_(bar)` survives intact.
 *
 * This runs on every message (up to 10,000 characters of untrusted text), so
 * it is a single linear pass: no backtracking patterns and no repeated
 * rescans while trimming.
 */
export function extractFirstHttpUrl(text: string): string | null {
  const start = text.search(URL_START);
  if (start < 0) {
    return null;
  }

  let end = start;
  const bracketCounts = new Map<string, number>();
  while (end < text.length) {
    const character = text.charAt(end);
    if (URL_TERMINATOR.test(character)) {
      break;
    }
    if (BRACKETS.has(character)) {
      bracketCounts.set(character, (bracketCounts.get(character) ?? 0) + 1);
    }
    end += 1;
  }

  // Trim from the right. A closing bracket is only dropped while the link has
  // more closers than openers, so the counts are updated as they are removed.
  while (end > start) {
    const last = text.charAt(end - 1);
    if (TRAILING_PUNCTUATION.has(last)) {
      end -= 1;
      continue;
    }
    const opener = BRACKET_OPENERS.get(last);
    const closers = bracketCounts.get(last) ?? 0;
    if (opener && closers > (bracketCounts.get(opener) ?? 0)) {
      bracketCounts.set(last, closers - 1);
      end -= 1;
      continue;
    }
    break;
  }

  const candidate = text.slice(start, end);
  const scheme = URL_START.exec(candidate);
  if (!scheme || candidate.length <= scheme[0].length) {
    return null;
  }
  return candidate;
}
