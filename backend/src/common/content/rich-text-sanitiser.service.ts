import { Injectable } from '@nestjs/common';
import createDOMPurify, { type Config } from 'dompurify';
import { JSDOM } from 'jsdom';

export const RICH_TEXT_POLICY_VERSION = 'rich-text-html-v1';

const RICH_TEXT_CONFIG: Config = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    'ul',
    'ol',
    'li',
    'blockquote',
    'code',
    'pre',
    'a',
  ],
  ALLOWED_ATTR: ['href', 'title'],
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
 * Sanitises only fields that the product explicitly defines as rich HTML.
 *
 * Ordinary messages, profiles, corrections and identifiers are plain text and
 * must be stored unchanged after their own DTO/domain validation. They are
 * rendered through text sinks rather than being destructively HTML-sanitised.
 */
@Injectable()
export class RichTextSanitiserService {
  private readonly window = new JSDOM('').window;
  private readonly purifier = createDOMPurify(this.window);

  sanitise(html: string): string {
    if (typeof html !== 'string') {
      throw new TypeError('Rich text input must be a string');
    }

    const sanitised = this.purifier.sanitize(html, RICH_TEXT_CONFIG);
    return this.normaliseLinks(String(sanitised));
  }

  destroy(): void {
    this.window.close();
  }

  onModuleDestroy(): void {
    this.destroy();
  }

  private normaliseLinks(html: string): string {
    const document = new JSDOM(`<body>${html}</body>`).window.document;
    for (const link of document.querySelectorAll('a')) {
      const href = link.getAttribute('href')?.trim() ?? '';
      if (!isAllowedRichTextUrl(href)) {
        link.removeAttribute('href');
      }
      link.setAttribute('rel', 'noopener noreferrer nofollow');
    }
    return document.body.innerHTML;
  }
}

function isAllowedRichTextUrl(value: string): boolean {
  if (!value) {
    return false;
  }
  if (value.startsWith('/') || value.startsWith('#')) {
    return true;
  }

  try {
    const url = new URL(value);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
}
