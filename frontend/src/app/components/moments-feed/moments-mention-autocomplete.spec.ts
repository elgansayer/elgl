import { describe, expect, it } from 'vitest';
import { formatMentionSuggestion } from './moments-feed.component';

describe('Moments mention autocomplete', () => {
  it('replaces only the active mention and preserves surrounding comment text', () => {
    expect(formatMentionSuggestion('Hi @Althere', 3, 6, 'Alice')).toBe('Hi @Alice there');
  });

  it('leaves the comment unchanged when selection ranges are missing or stale', () => {
    expect(formatMentionSuggestion('Hi @Ali', undefined, undefined, 'Alice')).toBe('Hi @Ali');
    expect(formatMentionSuggestion('Hi @Ali', 3, 99, 'Alice')).toBe('Hi @Ali');
  });
});
