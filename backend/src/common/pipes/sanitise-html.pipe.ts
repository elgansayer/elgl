import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

/**
 * Fields that must never pass through HTML sanitisation because they contain
 * non-user-authored technical data whose angle-bracket content is meaningful
 * (e.g. stack traces with `<anonymous>`, generic type parameters `<T>`, webhook signatures, etc.).
 */
export const SANITISATION_EXEMPT_FIELDS = new Set<string>([
  'stack',
  'componentStack',
  'rawBody',
  'signedPayload',
  'signedTransactionInfo',
  'signedRenewalInfo',
  'purchaseToken',
  'receiptData',
  'receiptToken',
  // Stack-frame fields that may contain angle brackets (e.g. <anonymous>)
  'functionName',
  'fileName',
  'source',
]);

export const SANITISATION_EXEMPT_KEYS = SANITISATION_EXEMPT_FIELDS;

function isExemptKey(keyName?: string): boolean {
  if (!keyName) {
    return false;
  }
  if (SANITISATION_EXEMPT_FIELDS.has(keyName)) {
    return true;
  }
  return keyName.toLowerCase().includes('password');
}

/**
 * @deprecated Plain-text request DTOs must not be recursively HTML-mutated.
 * Use SanitiseRichHtmlPipe only on fields whose contract explicitly allows
 * rich HTML.
 *
 * This compatibility pipe intentionally sanitises only a directly supplied
 * string. Objects and arrays are returned unchanged so technical payloads such
 * as client stack traces and provider-signed webhook bodies keep their exact
 * byte-for-byte text representation.
 */
@Injectable()
export class SanitiseHtmlPipe implements PipeTransform {
  transform(value: unknown, metadata?: ArgumentMetadata): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    if (metadata?.data && isExemptKey(metadata.data)) {
      return value;
    }

    const metatypeName = metadata?.metatype?.name;
    if (
      metatypeName === 'ClientErrorDto' ||
      metatypeName === 'LogClientErrorDto' ||
      metatypeName === 'AppleNotificationDto' ||
      metatypeName === 'GoogleNotificationDto'
    ) {
      return value;
    }

    return purify.sanitize(value, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
  }
}
