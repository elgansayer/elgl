import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

/**
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
      return purify.sanitize(value, STRICT_SANITISE_CONFIG);
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
