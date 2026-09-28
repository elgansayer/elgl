import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

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
  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    return purify.sanitize(value, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
  }
}
