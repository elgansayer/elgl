import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;

/**
 * Strict DOMPurify instance for Discovery Map user data.
 *
 * ALLOWED_TAGS and ALLOWED_ATTR are empty: only plain-text content survives
 * sanitisation. Discovery partner data (display_name, bio_text, interests,
 * MBTI types, etc.) is user-authored and must never contain rich HTML.
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
 * Deeply sanitise a value using the strict discovery DOMPurify config.
 *
 * Strings are run through DOMPurify (stripping all HTML).
 * Plain objects and arrays are recursed into.
 * Primitives (number, boolean, null, undefined) and class instances
 * (Date, Buffer, etc.) are returned unchanged.
 */
export function sanitiseDiscoveryData<T>(value: T): T {
  if (typeof value === 'string') {
    return strictPurify.sanitize(value) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitiseDiscoveryData(item)) as unknown as T;
  }

  if (value !== null && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return value;
    }

    const sanitised: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(
      value as unknown as Record<string, unknown>,
    )) {
      sanitised[key] = sanitiseDiscoveryData(val);
    }
    return sanitised as unknown as T;
  }

  return value;
}
