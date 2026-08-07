import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

/**
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
      // Exempt non-user-authored technical fields whose angle-bracket
      // content is meaningful (stack traces, webhook signatures, etc.)
      if (keyName && SANITISATION_EXEMPT_KEYS.has(keyName)) {
        return value;
      }
      return purify.sanitize(value);
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
