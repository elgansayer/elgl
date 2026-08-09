import { Injectable } from '@angular/core';
import createDOMPurify from 'dompurify';
import type { DOMPurify } from 'dompurify';

@Injectable({
  providedIn: 'root',
})
export class HtmlSanitisationService {
  private readonly purify: DOMPurify;

  constructor() {
    this.purify = createDOMPurify();
    // Strict sanitisation: strip ALL HTML tags, only plain text allowed
    this.purify.setConfig({
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      ALLOW_DATA_ATTR: false,
      ALLOWED_URI_REGEXP: /^(?!(?:javascript|data):)/i,
    });
  }

  /**
   * Sanitises a plain-text string by stripping all HTML tags.
   * Returns clean plain text only.
   */
  sanitiseText(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return this.purify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  }

  /**
   * Sanitises a URL for safe use in [href] or [src] bindings.
   * Strips HTML and also rejects javascript: and data: URLs.
   */
  sanitiseUrl(url: string): string {
    if (!url || typeof url !== 'string') return '';
    const sanitised = this.purify.sanitize(url, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    const lower = sanitised.trim().toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('data:')) {
      return '';
    }
    return sanitised;
  }
}
