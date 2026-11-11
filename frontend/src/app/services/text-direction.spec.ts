import { describe, expect, it } from 'vitest';
import { resolveTextDirection } from './text-direction';

describe('resolveTextDirection', () => {
  it.each(['ar', 'fa', 'he', 'ur'])('lays out the %s interface as RTL', (code) => {
    expect(resolveTextDirection(code)).toBe('rtl');
  });

  it.each(['ar-SA', 'ar-EG', 'he-IL', 'fa-IR', 'ur-PK', 'ar_MA', 'he_IL'])(
    'lays out the region-tagged locale %s as RTL',
    (tag) => {
      expect(resolveTextDirection(tag)).toBe('rtl');
    },
  );

  it.each(['AR', 'He-il', '  ar-SA  '])(
    'ignores letter case and surrounding whitespace in %j',
    (tag) => {
      expect(resolveTextDirection(tag)).toBe('rtl');
    },
  );

  it.each(['en-GB', 'en', 'es', 'fr-FR', 'ja', 'zh', 'hi', 'ko', 'sw'])(
    'lays out the %s interface as LTR',
    (tag) => {
      expect(resolveTextDirection(tag)).toBe('ltr');
    },
  );

  it.each(['arn', 'fat', 'her', 'urk'])(
    'matches whole primary subtags, so %s is not mistaken for an RTL language',
    (tag) => {
      expect(resolveTextDirection(tag)).toBe('ltr');
    },
  );

  it('falls back to LTR for an empty tag', () => {
    expect(resolveTextDirection('')).toBe('ltr');
    expect(resolveTextDirection('   ')).toBe('ltr');
  });
});
