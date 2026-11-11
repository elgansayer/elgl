/** Layout direction of the document, matching the HTML `dir` attribute values. */
export type TextDirection = 'ltr' | 'rtl';

/**
 * Primary language subtags whose interface is laid out in RTL.
 *
 * Only the primary subtag decides the direction, so `ar`, `ar-SA` and `he_IL`
 * all resolve to `rtl`. To support another RTL interface language, add its
 * subtag here and flag its `I18nService.availableLanguages` entry `isRtl`;
 * `text-direction.spec.ts` fails when the two disagree.
 */
const RTL_LANGUAGE_SUBTAGS: ReadonlySet<string> = new Set(['ar', 'fa', 'he', 'ur']);

/** Resolves the layout direction for a BCP 47 style language tag. */
export function resolveTextDirection(languageTag: string): TextDirection {
  const primarySubtag = languageTag.trim().toLowerCase().split(/[-_]/, 1)[0];
  return RTL_LANGUAGE_SUBTAGS.has(primarySubtag) ? 'rtl' : 'ltr';
}
