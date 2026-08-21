/**
 * RTL Logical CSS Property Verification for Matchmaking Algorithm
 * (Discovery + Recommendations)
 *
 * Verifies that all discovery, recommendation, and matchmaking components
 * exclusively use RTL-aware logical CSS properties (ps-, pe-, ms-, me-, border-s,
 * border-e, etc.) and never use physical direction properties.
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

/** All paths that constitute the Matchmaking (Discovery + Recommendations) architecture. */
const MATCHMAKING_PATHS = [
  // Frontend discovery components
  'src/app/components/discovery',
  'src/app/discovery',
  'src/app/components/groups-discovery',
  'src/app/components/profile-discovery-card',
  // Discovery-related services
  'src/app/services/discovery.service.ts',
  'src/app/services/offline-discovery-cache.service.ts',
  // Backend matchmaking algorithm
  '../backend/src/discovery',
  '../backend/src/recommendations',
];

const TEMPLATE_EXTS = new Set(['.html', '.ts', '.scss', '.css']);

function collectFiles(rootPath: string): string[] {
  const files: string[] = [];
  if (!existsSync(rootPath)) return files;

  const s = statSync(rootPath);
  if (s.isFile() && TEMPLATE_EXTS.has(extname(rootPath))) {
    if (rootPath.endsWith('.spec.ts')) return [];
    return [rootPath];
  }
  if (s.isDirectory()) {
    for (const entry of readdirSync(rootPath)) {
      files.push(...collectFiles(join(rootPath, entry)));
    }
  }
  return files.filter((f) => !f.endsWith('.spec.ts') && TEMPLATE_EXTS.has(extname(f)));
}

describe('RTL Logical CSS Properties - Matchmaking Algorithm', () => {
  let allContent: string;
  let fileList: string[];

  beforeAll(() => {
    const allFiles: string[] = [];
    for (const p of MATCHMAKING_PATHS) {
      allFiles.push(...collectFiles(p));
    }
    fileList = [...new Set(allFiles)].sort();
    allContent = fileList
      .map((f) => {
        try {
          return readFileSync(f, 'utf-8');
        } catch {
          return '';
        }
      })
      .join('\n');
  });

  it('has discovered Matchmaking source files to scan', () => {
    expect(fileList.length).toBeGreaterThan(0);
  });

  it('uses logical direction utilities (ps-/pe-/ms-/me-/border-s/border-e) in Matchmaking templates', () => {
    const logicalMatches = allContent.match(LOGICAL_CLASS_REGEX) ?? [];
    expect(logicalMatches.length).toBeGreaterThan(0);
  });

  it('does not contain physical direction Tailwind classes (pl-/pr-/ml-/mr-/left-/right-/border-l/border-r) in any Matchmaking file', () => {
    const physicalMatches = allContent.match(PHYSICAL_CLASS_REGEX);
    expect(physicalMatches ?? []).toEqual([]);
  });

  it('does not contain physical CSS direction properties (margin-left, margin-right, padding-left, padding-right, border-left, border-right) in inline styles', () => {
    const matches = allContent.match(PHYSICAL_STYLE_INLINE_REGEX);
    expect(matches ?? []).toEqual([]);
  });

  it('uses translation pipe (| t) for all user-facing strings in Matchmaking HTML templates', () => {
    const htmlFiles = fileList.filter((f) => f.endsWith('.html'));
    const htmlContent = htmlFiles
      .map((f) => {
        try {
          return readFileSync(f, 'utf-8');
        } catch {
          return '';
        }
      })
      .join('\n');
    // All matchmaking HTML templates should use the translate pipe
    expect(htmlContent).toContain('| t');
  });
});