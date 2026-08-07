import { Injectable, inject } from '@angular/core';
import DOMPurify from 'dompurify';

/**
 * Strict DOMPurify configuration: strip ALL HTML tags and attributes.
 * All user-submitted text must be plain text only.
 *
 * ALLOWED_TAGS: [] -- no HTML tags are permitted.
 * ALLOWED_ATTR: [] -- no HTML attributes are permitted.
 * ALLOW_DATA_ATTR: false -- no data-* attributes.
 * KEEP_CONTENT: true -- preserve text content, only remove tags/attributes.
 */
const STRICT_SANITISE_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true,
};

@Injectable({
  providedIn: 'root',
})
export class SanitiseHtmlService {
  /**
   * Strips all HTML tags from the input string, preserving text content.
   * Returns plain text only.
   */
  sanitise(value: string): string {
    return DOMPurify.sanitize(value, STRICT_SANITISE_CONFIG);
  }

  /**
   * Recursively sanitises an object's string values in-place.
   * Skips password-like fields.
   */
  sanitiseObject<T extends Record<string, unknown>>(obj: T): T {
    const result = { ...obj };
    for (const [key, val] of Object.entries(result)) {
      if (typeof val === 'string' && !key.toLowerCase().includes('password')) {
        (result as Record<string, unknown>)[key] = this.sanitise(val);
      } else if (this.isPlainObject(val)) {
        (result as Record<string, unknown>)[key] = this.sanitiseObject(
          val as Record<string, unknown>,
        );
      }
    }
    return result;
  }

  private isPlainObject(val: unknown): val is Record<string, unknown> {
    if (val === null || typeof val !== 'object') return false;
    const proto = Object.getPrototypeOf(val) as unknown;
    return proto === Object.prototype || proto === null;
  }
}