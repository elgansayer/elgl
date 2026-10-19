/**
 * RTL Logical CSS Property Verification for Matchmaking Algorithm
 *
 * Verifies that all discovery and matchmaking components exclusively
 * use RTL-aware logical CSS properties (ps-, pe-, ms-, me-, border-s, border-e, etc.)
 * and never use physical direction properties.
 *
 * Issue #2285: Task: Verify RTL logical CSS properties (ps-, pe-) for Matchmaking Algorithm
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const PHYSICAL_CLASS_REGEX =
  /\b(pl-|pr-|ml-|mr-|left-|right-|border-l\b|border-r\b|text-left|text-right|float-left|float-right|rounded-l\b|rounded-r\b)/g;
const PHYSICAL_STYLE_INLINE_REGEX =
  /\b(margin-left|margin-right|padding-left|padding-right|border-left\b|border-right\b)\s*:/gi;

const LOGICAL_CLASS_REGEX =
  /\b(ps-|pe-|ms-|me-|border-s\b|border-e\b|text-start|text-end|float-start|float-end)/g;

/**
 * All file paths under the "Matchmaking Algorithm" umbrella.
 * This includes Discovery, Study Buddy, Global Search,
 * Profile Discovery Cards, and Groups Discovery.
 */
const MATCHMAKING_PATHS = [
  'src/app/components/discovery',
  'src/app/components/discovery/global-search',
  'src/app/components/study-buddy',
  'src/app/components/groups-discovery',
  'src/app/components/profile-discovery-card',
  'src/app/discovery',
  'src/app/services/discovery.service.ts',
  'src/app/services/study-buddy.service.ts',
];

const TEMPLATE_EXTS = new Set(['.html', '.ts', '.scss', '.css']);

function collectFiles(rootPath: string): string[] {
  const files: string[] = [];

  if (!existsSync(rootPath)) return files;

  const st = statSync(rootPath);
  if (st.isFile() && TEMPLATE_EXTS.has(extname(rootPath))) {
    const name = rootPath;
    if (name.endsWith('.spec.ts')) return [];
    return [rootPath];
  }
  if (st.isDirectory()) {
    for (const entry of readdirSync(rootPath)) {
      files.push(...collectFiles(join(rootPath, entry)));
    }
  }
  return files.filter((f) => {
    if (!TEMPLATE_EXTS.has(extname(f))) return false;
    if (f.endsWith('.spec.ts')) return false;
    return true;
  });
}

describe('RTL Logical CSS Properties - Matchmaking Algorithm (#2285)', () => {
  let allContent: string;
  let collectedFiles: string[];

  beforeAll(() => {
    const allFiles: string[] = [];
    for (const p of MATCHMAKING_PATHS) {
      allFiles.push(...collectFiles(p));
    }
    collectedFiles = allFiles;
    allContent = allFiles
      .map((f) => {
        try {
          return readFileSync(f, 'utf-8');
        } catch {
          return '';
        }
      })
      .join('\n');
  });

  it('should have matchmaking files to verify', () => {
    expect(collectedFiles.length).toBeGreaterThan(0);
  });

  it('should use logical direction utilities (ps-/pe-/ms-/me-/border-s/border-e) in matchmaking templates', () => {
    const logicalMatches = allContent.match(LOGICAL_CLASS_REGEX) ?? [];
    expect(logicalMatches.length).toBeGreaterThan(0);
  });

  it('should not contain physical direction Tailwind classes (pl-/pr-/ml-/mr-/left-/right-/border-l/border-r) in matchmaking templates', () => {
    const violations: string[] = [];
    const physicalMatches = allContent.match(PHYSICAL_CLASS_REGEX);
    if (physicalMatches) {
      violations.push(...physicalMatches);
    }
    expect(violations).toEqual([]);
  });

  it('should not contain physical CSS direction properties (margin-left, margin-right, padding-left, padding-right, border-left, border-right) in inline styles', () => {
    const matches = allContent.match(PHYSICAL_STYLE_INLINE_REGEX);
    expect(matches ?? []).toEqual([]);
  });
});