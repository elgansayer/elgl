/**
 * RTL Logical CSS Property Verification for Discovery Map
 *
 * Verifies that all Discovery Map components exclusively
 * use RTL-aware logical CSS properties (ps-, pe-, ms-, me-, border-s, border-e, etc.)
 * and never use physical direction properties.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const PHYSICAL_CLASS_REGEX = /\b(pl-|pr-|ml-|mr-|left-|right-|border-l\b|border-r\b|text-left|text-right|float-left|float-right|rounded-l\b|rounded-r\b)/g;
const PHYSICAL_STYLE_INLINE_REGEX = /\b(margin-left|margin-right|padding-left|padding-right|border-left\b|border-right\b)\s*:/gi;

const LOGICAL_CLASS_REGEX = /\b(ps-|pe-|ms-|me-|border-s\b|border-e\b|text-start|text-end|float-start|float-end)/g;

const DISCOVERY_MAP_PATHS = [
  'src/app/components/discovery',
  'src/app/discovery',
  'src/app/components/profile-discovery-card',
  'src/app/components/distance-slider',
  'src/app/components/age-range-slider',
  'src/app/components/groups-discovery',
  'src/app/services/discovery.service.ts',
  'src/app/services/offline-discovery-cache.service.ts',
];

const TEMPLATE_EXTS = new Set(['.html', '.ts', '.scss', '.css']);

function collectFiles(rootPath: string, excludeSpec = true): string[] {
  const files: string[] = [];

  if (!existsSync(rootPath)) return files;

  const stat = statSync(rootPath);
  if (stat.isFile() && TEMPLATE_EXTS.has(extname(rootPath))) {
    if (excludeSpec && rootPath.endsWith('.spec.ts')) return [];
    return [rootPath];
  }
  if (stat.isDirectory()) {
    for (const entry of readdirSync(rootPath)) {
      files.push(...collectFiles(join(rootPath, entry), excludeSpec));
    }
  }
  return files.filter((f) => {
    if (!TEMPLATE_EXTS.has(extname(f))) return false;
    if (excludeSpec && f.endsWith('.spec.ts')) return false;
    return true;
  });
}

describe('RTL Logical CSS Properties - Discovery Map', () => {
  let allContent: string;

  beforeAll(() => {
    const allFiles: string[] = [];
    for (const p of DISCOVERY_MAP_PATHS) {
      allFiles.push(...collectFiles(p));
    }
    const filtered = allFiles.filter((f) => !f.endsWith('.spec.ts'));
    allContent = filtered
      .map((f) => {
        try {
          return readFileSync(f, 'utf-8');
        } catch {
          return '';
        }
      })
      .join('\n');
  });

  it('should use logical direction utilities (ps-/pe-/ms-/me-/border-s/border-e) in Discovery Map templates', () => {
    const logicalMatches = allContent.match(LOGICAL_CLASS_REGEX) ?? [];
    expect(logicalMatches.length).toBeGreaterThan(0);
  });

  it('should not contain physical direction Tailwind classes (pl-/pr-/ml-/mr-/left-/right-/border-l/border-r) in Discovery Map templates', () => {
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