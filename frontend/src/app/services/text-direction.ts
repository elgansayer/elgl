export type TextDirection = 'ltr' | 'rtl';

/**
 * Languages written right to left in their default script (CLDR likely
 * subtags). Languages that can be written in more than one script, such as
 * Kurdish or Punjabi, are decided by an explicit script subtag instead.
 */
const RTL_LANGUAGES: ReadonlySet<string> = new Set([
  'ar',
  'arc',
  'ary',
  'arz',
  'azb',
  'ckb',
  'dv',
  'fa',
  'he',
  'iw',
  'ji',
  'ks',
  'pnb',
  'prs',
  'ps',
  'sd',
  'syr',
  'ug',
  'ur',
  'yi',
]);

/** ISO 15924 scripts that are written right to left. */
const RTL_SCRIPTS: ReadonlySet<string> = new Set([
  'adlm',
  'arab',
  'hebr',
  'mand',
  'mend',
  'nkoo',
  'rohg',
  'samr',
  'syrc',
  'thaa',
]);

const SCRIPT_SUBTAG = /^[a-z]{4}$/;

/**
 * Resolves the layout direction for a BCP 47 style locale such as `ar`,
 * `ar-SA`, `he-IL`, `az-Arab` or `en-GB`.
 *
 * An explicit script subtag always wins because it states how the text is
 * written (`az-Arab` is right to left, `ar-Latn` is not). Without one the
 * primary language decides. Underscore separators and any letter case are
 * accepted so that a locale from storage, a profile or a browser behaves the
 * same. Unknown or empty input is treated as left to right.
 *
 * This is the single source of truth for interface mirroring: the document
 * `dir` attribute, the `direction` signal and any rollback of a failed language
 * change must all use it so that a region-tagged locale such as `ar-EG` is
 * mirrored exactly like `ar`.
 */
export function resolveTextDirection(locale: string): TextDirection {
  const subtags = locale.trim().toLowerCase().split(/[-_]/);
  const language = subtags[0] ?? '';
  const script = subtags.slice(1).find((subtag) => SCRIPT_SUBTAG.test(subtag));

  if (script) {
    return RTL_SCRIPTS.has(script) ? 'rtl' : 'ltr';
  }
  return RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr';
}
