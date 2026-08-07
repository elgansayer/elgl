import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;

/**
 * Strict DOMPurify instance for the Virtual Coin Economy.
 *
 * ALLOWED_TAGS and ALLOWED_ATTR are empty so that only plain-text content
 * survives sanitisation. Economy data (gift names, icons, animation URLs,
 * sticker pack names, etc.) comes from a server-controlled database and
 * should never contain user-authored rich HTML. Stripping everything ensures
 * that even if a row is poisoned via a compromised admin panel or SQL
 * injection, the client receives only clean values.
 */
const strictPurify = DOMPurify(window);
strictPurify.setConfig({
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?:)?\/\/)/i,
  KEEP_CONTENT: false,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  WHOLE_DOCUMENT: false,
  SANITIZE_DOM: true,
  SANITIZE_NAMED_PROPS: true,
});

/**
 * Deeply sanitise a value using the strict economy DOMPurify config.
 *
 * Rules:
 * - Strings are run through DOMPurify (stripping all HTML).
 * - Plain objects and arrays are recursed into.
 * - Primitives (number, boolean, null, undefined) and class instances
 *   (Date, Buffer, etc.) are returned unchanged.
 *
 * The generic signature preserves the caller's type without requiring
 * type assertions at the call site.
 */
export function sanitiseEconomyData<T>(value: T): T {
  if (typeof value === 'string') {
    return strictPurify.sanitize(value) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitiseEconomyData(item)) as unknown as T;
  }

  if (value !== null && typeof value === 'object') {
    // Do not traverse class instances (Date, custom types, etc.)
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return value;
    }

    const sanitised: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(
      value as unknown as Record<string, unknown>,
    )) {
      sanitised[key] = sanitiseEconomyData(val);
    }
    return sanitised as unknown as T;
  }

  return value;
}

// ---------------------------------------------------------------------------
// GDPR data scrubbing helpers for the Virtual Coin Economy
// ---------------------------------------------------------------------------

/**
 * Minimum length for a receipt token before scrubbing.
 * Tokens shorter than this are fully replaced with a placeholder because
 * revealing even 4 characters of a very short token could be identifying.
 */
const MIN_TOKEN_LENGTH_FOR_SCRUB = 8;

/**
 * Number of trailing characters to preserve when scrubbing a receipt token.
 */
const SCRUB_PRESERVE_LENGTH = 4;

/**
 * Scrub a receipt token for GDPR archive export.
 *
 * Rules:
 * - `null` / `undefined` / empty string are returned as-is.
 * - Tokens shorter than {@link MIN_TOKEN_LENGTH_FOR_SCRUB} are replaced
 *   with a fixed `[REDACTED-SHORT-TOKEN]` placeholder.
 * - Otherwise only the last {@link SCRUB_PRESERVE_LENGTH} characters are
 *   preserved, prefixed with `***...`.
 *
 * This ensures that Stripe session IDs, Apple receipt data blobs, and
 * Google Play purchase tokens cannot be replayed from the archive export.
 */
export function scrubReceiptToken(token: string | null | undefined): string | null {
  if (token == null || token === '') {
    return token as null;
  }

  if (token.length < MIN_TOKEN_LENGTH_FOR_SCRUB) {
    return '[REDACTED-SHORT-TOKEN]';
  }

  return '***...' + token.slice(-SCRUB_PRESERVE_LENGTH);
}

/**
 * Fields in a coin_purchases row that contain potentially sensitive financial
 * data and should be scrubbed in GDPR archive exports.
 */
const COIN_PURCHASE_SCRUB_FIELDS = new Set([
  'receipt_token',
  'transaction_id',
]);

/**
 * Scrub a single coin_purchases record for GDPR archive export.
 *
 * The `receipt_token` and `transaction_id` fields are deeply scrubbed using
 * {@link scrubReceiptToken}. All other fields are passed through unchanged.
 *
 * If the input is `null` or `undefined`, it is returned as-is.
 */
export function scrubCoinPurchaseForArchive(
  record: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null | undefined {
  if (record == null) {
    return record;
  }

  const scrubbed: Record<string, unknown> = { ...record };
  for (const key of Object.keys(scrubbed)) {
    if (COIN_PURCHASE_SCRUB_FIELDS.has(key)) {
      scrubbed[key] = scrubReceiptToken(
        typeof scrubbed[key] === 'string' ? scrubbed[key] as string : null,
      );
    }
  }
  return scrubbed;
}

/**
 * Scrub an array of coin_purchases records for GDPR archive export.
 *
 * Each element is processed through {@link scrubCoinPurchaseForArchive}.
 * Non-array or null/undefined values are returned as-is.
 */
export function scrubCoinPurchasesForArchive(
  records: unknown[] | null | undefined,
): unknown[] | null | undefined {
  if (records == null || !Array.isArray(records)) {
    return records as unknown[] | null | undefined;
  }

  return records.map((record) => {
    if (record !== null && typeof record === 'object') {
      return scrubCoinPurchaseForArchive(record as Record<string, unknown>);
    }
    return record;
  });
}