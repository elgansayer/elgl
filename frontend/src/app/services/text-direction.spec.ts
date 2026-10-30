import { describe, expect, it } from 'vitest';
import { resolveTextDirection } from './text-direction';

describe('resolveTextDirection', () => {
  it.each(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv', 'ckb', 'iw'])(
    'mirrors the interface for the right-to-left language %s',
    (locale) => {
      expect(resolveTextDirection(locale)).toBe('rtl');
    },
  );

  it.each(['ar-SA', 'ar-EG', 'he-IL', 'fa-IR', 'ur-PK', 'ps-AF'])(
    'keeps a region-tagged locale such as %s right to left',
    (locale) => {
      expect(resolveTextDirection(locale)).toBe('rtl');
    },
  );

  it.each(['en-GB', 'en', 'es', 'fr-CA', 'de', 'ja', 'zh', 'zh-Hant-TW', 'ko', 'hi', 'th', 'sw'])(
    'keeps %s left to right',
    (locale) => {
      expect(resolveTextDirection(locale)).toBe('ltr');
    },
  );

  it('lets an explicit script subtag decide for multi-script languages', () => {
    expect(resolveTextDirection('az')).toBe('ltr');
    expect(resolveTextDirection('az-Arab')).toBe('rtl');
    expect(resolveTextDirection('az-Arab-IR')).toBe('rtl');
    expect(resolveTextDirection('ku')).toBe('ltr');
    expect(resolveTextDirection('ku-Arab')).toBe('rtl');
    expect(resolveTextDirection('pa')).toBe('ltr');
    expect(resolveTextDirection('pa-Arab')).toBe('rtl');
    expect(resolveTextDirection('ff-Adlm')).toBe('rtl');
  });

  it('lets a left-to-right script override a right-to-left language', () => {
    expect(resolveTextDirection('ar-Latn')).toBe('ltr');
    expect(resolveTextDirection('ur-Latn-PK')).toBe('ltr');
  });

  it('is insensitive to case and to underscore separators', () => {
    expect(resolveTextDirection('AR')).toBe('rtl');
    expect(resolveTextDirection('ar_SA')).toBe('rtl');
    expect(resolveTextDirection('HE-il')).toBe('rtl');
    expect(resolveTextDirection('az_arab')).toBe('rtl');
    expect(resolveTextDirection('  fa-IR  ')).toBe('rtl');
  });

  it('treats unknown or empty input as left to right', () => {
    expect(resolveTextDirection('')).toBe('ltr');
    expect(resolveTextDirection('   ')).toBe('ltr');
    expect(resolveTextDirection('xx')).toBe('ltr');
    expect(resolveTextDirection('not a locale')).toBe('ltr');
  });

  it('does not confuse a region or variant subtag with a language', () => {
    expect(resolveTextDirection('en-AR')).toBe('ltr');
    expect(resolveTextDirection('es-419')).toBe('ltr');
    expect(resolveTextDirection('de-IL')).toBe('ltr');
  });
});
