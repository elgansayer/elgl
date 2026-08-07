import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Strict sanitisation: strip ALL HTML tags and attributes, only allow plain text.
purify.setConfig({
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?!(?:javascript|data):)/i,
});

/**
<<<<<<< HEAD
 * Strict DOMPurify configuration: strip ALL HTML tags and attributes.
 * All user-submitted text must be plain text only.
 *
 * ALLOWED_TAGS: [] -- no HTML tags are permitted.
 * ALLOWED_ATTR: [] -- no HTML attributes are permitted.
 * ALLOW_DATA_ATTRS: false -- no data-* attributes.
 * KEEP_CONTENT: true -- preserve text content, only remove tags/attributes.
 */
const STRICT_SANITISE_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true,
};
=======
 * Fields that must never pass through HTML sanitisation because they contain
 * non-user-authored technical data whose angle-bracket content is meaningful
 * (e.g. stack traces with `<anonymous>`, webhook signatures, etc.).
 */
const SANITISATION_EXEMPT_KEYS = new Set([
  'stack',
  'componentStack',
  'rawBody',
  'signedPayload',
  // Stack-frame fields that may contain angle brackets (e.g. <anonymous>)
  'functionName',
  'fileName',
  'source',
]);
>>>>>>> origin/main

@Injectable()
export class SanitiseHtmlPipe implements PipeTransform {
  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    return this.sanitiseValue(value);
  }

  private isPlainObject(val: unknown): val is Record<string, unknown> {
    if (val === null || typeof val !== 'object') {
      return false;
    }
    const proto = Object.getPrototypeOf(val) as unknown;
    return proto === Object.prototype || proto === null;
  }

  private sanitiseValue(value: unknown, keyName?: string): unknown {
    if (typeof value === 'string') {
      // Skip sanitisation for password fields to avoid corrupting legitimate passwords
      if (keyName && keyName.toLowerCase().includes('password')) {
        return value;
      }
<<<<<<< HEAD
      return purify.sanitize(value, STRICT_SANITISE_CONFIG);
=======
      // Exempt non-user-authored technical fields whose angle-bracket
      // content is meaningful (stack traces, webhook signatures, etc.)
      if (keyName && SANITISATION_EXEMPT_KEYS.has(keyName)) {
        return value;
      }
<<<<<<< HEAD
      return purify.sanitize(value);
>>>>>>> origin/main
=======
      return purify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
>>>>>>> origin/main
    }

    if (Array.isArray(value)) {
      return value.map((item: unknown) => this.sanitiseValue(item, keyName));
    }

    if (this.isPlainObject(value)) {
      const sanitised: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        sanitised[key] = this.sanitiseValue(val, key);
      }
      return sanitised;
    }

    return value;
  }
}
