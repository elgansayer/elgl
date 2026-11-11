import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const frontendRoot = process.cwd();
const read = (path: string): string => readFileSync(resolve(frontendRoot, path), 'utf8');

const template = read('src/app/components/moments-feed/moments-feed.component.html');
const store = read('src/app/services/moments.store.ts');
const dictionary = read('src/app/services/i18n.service.ts');

describe('Moments feed copyright takedown contract', () => {
  it('carries the server marker on both Moments and comments', () => {
    expect(store.match(/dmca_disabled_at\?: string \| null;/g)).toHaveLength(2);
  });

  it('replaces a disabled Moment with a translated note instead of an empty card', () => {
    expect(template).toContain('@if (moment.dmca_disabled_at)');
    expect(template).toContain("{{ 'dmca.contentDisabled' | t }}");
    expect(template).toContain('data-testid="moment-dmca-disabled"');
  });

  it('replaces a disabled comment with a translated note', () => {
    expect(template).toContain('@if (comment.dmca_disabled_at)');
    expect(template).toContain("{{ 'dmca.commentDisabled' | t }}");
    expect(template).toContain('data-testid="comment-dmca-disabled"');
  });

  it('announces the note politely and without relying on colour alone', () => {
    const notes = template.match(/role="note"/g) ?? [];
    expect(notes.length).toBeGreaterThanOrEqual(2);
    expect(template).toContain('italic');
  });

  it('defines the note copy in the base dictionary', () => {
    expect(dictionary).toContain("'dmca.contentDisabled':");
    expect(dictionary).toContain("'dmca.commentDisabled':");
  });
});
