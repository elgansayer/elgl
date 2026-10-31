import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

function frontendRoot(): string {
  const cwd = process.cwd();
  return cwd.endsWith('/frontend') || cwd.endsWith('\\frontend') ? cwd : join(cwd, 'frontend');
}

function walkUiSources(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return walkUiSources(path);
    const isSource = entry.endsWith('.ts') || entry.endsWith('.html');
    return isSource && !entry.endsWith('.spec.ts') ? [path] : [];
  });
}

/**
 * I18nService.setLanguage is the legacy, fail-open loader: it changes the active
 * locale, the document lang/dir and the persisted locale before it knows whether
 * a dictionary could be loaded, and it swallows provider, authentication and
 * network failures. User-facing pickers must call
 * UiLanguagePreferenceService.changeLanguage instead, which rolls back on failure.
 */
const legacyLoaderCall = /\bi18n\w*\s*\??\.\s*setLanguage\s*\(/gi;

function callsLegacyLoader(source: string): boolean {
  legacyLoaderCall.lastIndex = 0;
  return legacyLoaderCall.test(source);
}

/** The only file allowed to drive the legacy loader on behalf of the UI. */
const transactionalBoundary = 'src/app/services/ui-language-preference.service.ts';

describe('interface-language single-owner contract', () => {
  it('detects direct legacy loader calls in code and templates', () => {
    expect(callsLegacyLoader('this.i18n.setLanguage(code);')).toBe(true);
    expect(callsLegacyLoader('await this.i18nService.setLanguage(value)')).toBe(true);
    expect(callsLegacyLoader('i18n?.setLanguage ( code )')).toBe(true);
    expect(callsLegacyLoader('(click)="i18n.setLanguage(lang.code)"')).toBe(true);
  });

  it('ignores unrelated setLanguage methods and the transactional entry point', () => {
    expect(callsLegacyLoader('setLanguage(code: string): void { this.filter.set(code); }')).toBe(
      false,
    );
    expect(callsLegacyLoader('(click)="setLanguage(lang.code)"')).toBe(false);
    expect(callsLegacyLoader('await this.languagePreference.changeLanguage(code);')).toBe(false);
    expect(callsLegacyLoader('this.setLanguage(savedLang);')).toBe(false);
  });

  it('keeps every interface-language picker behind UiLanguagePreferenceService', () => {
    const root = frontendRoot();
    const violations: string[] = [];

    for (const file of walkUiSources(join(root, 'src/app'))) {
      const path = relative(root, file).replaceAll('\\', '/');
      if (path === transactionalBoundary) continue;
      if (callsLegacyLoader(readFileSync(file, 'utf8'))) violations.push(path);
    }

    expect(violations).toEqual([]);
  });

  it('still routes the transactional boundary through the legacy loader exactly once', () => {
    const source = readFileSync(join(frontendRoot(), transactionalBoundary), 'utf8');

    expect(source.match(legacyLoaderCall)).toHaveLength(1);
  });
});
