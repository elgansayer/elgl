/**
 * RTL Logical CSS Property Verification for Admin Moderation Dashboard
 *
 * Verifies that all admin and moderation dashboard components exclusively
 * use RTL-aware logical CSS properties (ps-, pe-, ms-, me-, border-s, border-e, etc.)
 * and never use physical direction properties.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const PHYSICAL_CLASS_REGEX = /\b(pl-|pr-|ml-|mr-|left-|right-|border-l\b|border-r\b|text-left|text-right|float-left|float-right|rounded-l\b|rounded-r\b)/g;
const PHYSICAL_STYLE_INLINE_REGEX = /\b(margin-left|margin-right|padding-left|padding-right|border-left\b|border-right\b)\s*:/gi;

const LOGICAL_CLASS_REGEX = /\b(ps-|pe-|ms-|me-|border-s\b|border-e\b|text-start|text-end|float-start|float-end)/g;

const ADMIN_MODERATION_PATHS = [
  'src/app/admin',
  'src/app/moderation',
  'src/app/components/admin-portal',
  'src/app/components/moderation-queue',
  'src/app/components/moderation',
  'src/app/components/admin-actions',
  'src/app/components/admin-user-actions',
  'src/app/components/lesson-manager',
  'src/app/pages/admin',
  'src/app/services/admin.service.ts',
  'src/app/services/moderation.service.ts',
  'src/app/guards/admin.guard.ts',
];

const TEMPLATE_EXTS = new Set(['.html', '.ts', '.scss', '.css']);

function collectFiles(rootPath: string, excludeSpec = true): string[] {
  const files: string[] = [];

  if (!existsSync(rootPath)) return files;

  const stat = statSync(rootPath);
  if (stat.isFile() && TEMPLATE_EXTS.has(extname(rootPath))) {
    const name = rootPath;
    if (excludeSpec && name.endsWith('.spec.ts')) return [];
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

describe('RTL Logical CSS Properties - Admin Moderation Dashboard', () => {
  let allContent: string;

  beforeAll(() => {
    const allFiles: string[] = [];
    for (const p of ADMIN_MODERATION_PATHS) {
      allFiles.push(...collectFiles(p));
    }
    // Exclude this test file itself from being checked
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

  it('should use logical direction utilities (ps-/pe-/ms-/me-/border-s/border-e) in admin/moderation templates', () => {
    const logicalMatches = allContent.match(LOGICAL_CLASS_REGEX) ?? [];
    expect(logicalMatches.length).toBeGreaterThan(0);
  });

  it('should not contain physical direction Tailwind classes (pl-/pr-/ml-/mr-/left-/right-/border-l/border-r) in admin/moderation templates', () => {
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