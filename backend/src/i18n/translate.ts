import { backendDictionary, DEFAULT_UI_LOCALE } from './backend-dictionary';

const INTERPOLATION_PATTERN = /\{\{(\w+)\}\}/g;

/** Resolves a stored locale to a dictionary locale, falling back to en-GB. */
export function normalizeBackendLocale(locale?: string | null): string {
  const candidate = locale?.trim();
  if (!candidate) return DEFAULT_UI_LOCALE;
  if (backendDictionary[candidate]) return candidate;

  const base = candidate.split('-', 1)[0].toLowerCase();
  const matching = Object.keys(backendDictionary).find(
    (code) => code.split('-', 1)[0].toLowerCase() === base,
  );
  return matching ?? DEFAULT_UI_LOCALE;
}

/** Reports whether a key has copy in any shipped locale. */
export function hasBackendCopy(key: string): boolean {
  return Object.values(backendDictionary).some((dictionary) =>
    Object.prototype.hasOwnProperty.call(dictionary, key),
  );
}

/** Resolves backend copy without requiring the injectable service. */
export function translateBackendCopy(
  key: string,
  locale?: string | null,
  params?: Record<string, string | number>,
): string {
  const normalized = normalizeBackendLocale(locale);
  const template =
    backendDictionary[normalized]?.[key] ??
    backendDictionary[DEFAULT_UI_LOCALE][key] ??
    key;

  if (!params) return template;
  return template.replace(INTERPOLATION_PATTERN, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : match,
  );
}
