import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import createDOMPurify, { type Config } from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = createDOMPurify(window);

const STRICT_TEXT_CONFIG: Config = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  FORBID_TAGS: [
    'script',
    'style',
    'form',
    'input',
    'button',
    'iframe',
    'object',
    'embed',
    'svg',
    'math',
  ],
  FORBID_ATTR: ['style', 'srcdoc'],
  RETURN_TRUSTED_TYPE: false,
};

/**
 * @deprecated Plain-text DTOs must be domain-validated and rendered through
 * text sinks. Rich HTML fields must use `SanitiseRichHtmlPipe`. This legacy
 * compatibility pipe is retained only for callers that explicitly pass one
 * string and need all markup stripped; it must never be registered globally
 * or applied recursively to request objects.
 */
@Injectable()
export class SanitiseHtmlPipe implements PipeTransform<unknown, unknown> {
  transform(value: unknown, _metadata?: ArgumentMetadata): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    return String(purify.sanitize(value, STRICT_TEXT_CONFIG));
  }
}
