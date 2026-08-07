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

/**
 * Scrub a receipt token for GDPR archive export.
 *
 * Receipt tokens (Apple receipt-data, Google Play purchase tokens, Stripe
 * session IDs) are PII under GDPR because they link a natural person to a
 * financial transaction. We preserve the last 4 characters for support
 * reference while redacting the rest.
 *
 * Returns null/undefined/empty-string unchanged. Tokens shorter than 8
 * characters are fully redacted as they cannot be meaningfully truncated.
 */
export function scrubReceiptToken(
  raw: string | null | undefined,
): string | null | undefined {
  if (raw === null || raw === undefined || raw === '') {
    return raw;
  }
  if (raw.length < 8) {
    return '[REDACTED-SHORT-TOKEN]';
  }
  return `***...${raw.slice(-4)}`;
}

/**
 * Scrub a single coin-purchase record for GDPR archive export.
 *
 * Returns null/undefined unchanged. Returns a shallow copy with
 * receipt_token and transaction_id redacted via scrubReceiptToken.
 * Does not mutate the original record.
 */
export function scrubCoinPurchaseForArchive(
  record: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null | undefined {
  if (record === null || record === undefined) {
    return record;
  }
  return {
    ...record,
    receipt_token: scrubReceiptToken(
      record['receipt_token'] as string | null | undefined,
    ),
    transaction_id: scrubReceiptToken(
      record['transaction_id'] as string | null | undefined,
    ),
  };
}

/**
 * Scrub an array of coin-purchase records for GDPR archive export.
 *
 * Returns null/undefined unchanged. Returns a new array where each record
 * is scrubbed via scrubCoinPurchaseForArchive. Non-object entries pass
 * through unchanged. Does not mutate originals.
 */
export function scrubCoinPurchasesForArchive(
  records: Record<string, unknown>[] | null | undefined,
): Record<string, unknown>[] | null | undefined {
  if (records === null || records === undefined) {
    return records;
  }
  return records.map((r) => {
    if (r !== null && typeof r === 'object') {
      return scrubCoinPurchaseForArchive(r);
    }
    return r;
  }) as Record<string, unknown>[];
}
