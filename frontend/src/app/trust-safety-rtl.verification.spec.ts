/**
 * RTL Logical CSS Property Verification for Trust & Safety Architecture
 *
 * Verifies that all Trust & Safety components, services, and pages exclusively
 * use RTL-aware logical CSS properties (ps-, pe-, ms-, me-, border-s, border-e, etc.)
 * and never use physical direction properties. This serves as a production-readiness
 * gate for RTL support in the Trust & Safety feature set.
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

/** All paths that constitute the Trust & Safety architecture. */
const TRUST_SAFETY_PATHS = [
  // Core T&S modal components
  'src/app/components/trust-safety-modal',
  'src/app/components/report-user-modal',
  // Moderation components
  'src/app/components/moderation',
  'src/app/components/moderation-queue',
  'src/app/moderation',
  // Admin T&S views
  'src/app/components/admin-portal',
  'src/app/components/admin-actions',
  'src/app/components/admin-user-actions',
  'src/app/admin',
  'src/app/pages/admin',
  // Block management
  'src/app/pages/block-management',
  // Core T&S services
  'src/app/services/safety.service.ts',
  'src/app/services/moderation.service.ts',
  'src/app/services/admin.service.ts',
  'src/app/services/block.service.ts',
  'src/app/services/blocked-users.service.ts',
  'src/app/services/economy.store.ts',
  'src/app/services/offline-admin-storage.service.ts',
  // T&S guards
  'src/app/guards/admin.guard.ts',
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

describe('RTL Logical CSS Properties - Trust & Safety Architecture', () => {
  let allContent: string;
  let fileList: string[];

  beforeAll(() => {
    const allFiles: string[] = [];
    for (const p of TRUST_SAFETY_PATHS) {
      allFiles.push(...collectFiles(p));
    }
    // Deduplicate in case of path overlaps
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

  it('has discovered Trust & Safety source files to scan', () => {
    expect(fileList.length).toBeGreaterThan(0);
  });

  it('uses logical direction utilities (ps-/pe-/ms-/me-/border-s/border-e) in Trust & Safety templates', () => {
    const logicalMatches = allContent.match(LOGICAL_CLASS_REGEX) ?? [];
    expect(logicalMatches.length).toBeGreaterThan(0);
  });

  it('does not contain physical direction Tailwind classes (pl-/pr-/ml-/mr-/left-/right-/border-l/border-r) in any Trust & Safety file', () => {
    const physicalMatches = allContent.match(PHYSICAL_CLASS_REGEX);
    expect(physicalMatches ?? []).toEqual([]);
  });

  it('does not contain physical CSS direction properties (margin-left, margin-right, padding-left, padding-right, border-left, border-right) in inline styles', () => {
    const matches = allContent.match(PHYSICAL_STYLE_INLINE_REGEX);
    expect(matches ?? []).toEqual([]);
  });

  it('no Trust & Safety template hardcodes English user-facing strings outside i18n expressions', () => {
    // Only scan HTML templates for hardcoded UI text
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
    // Strip all i18n expressions (translate pipe and interpolation) so only
    // literal text between HTML tags remains.
    const cleaned = htmlContent
      .replace(/\{\{.*?\}\}/gs, '')
      .replace(/'[^']*'\s*\|\s*t/g, '')
      .replace(/"[^"]*"\s*\|\s*t/g, '');
    // Check for English UI strings that are common in Trust & Safety
    // (case-insensitive to catch any casing variant)
    const hardcodedPatterns = [
      /Submit report/i,
      /Confirm block/i,
      /Block this user/i,
      /Report user/i,
      /Harassment\s*\/\s*Bullying/i,
      /Spam\s*\/\s*Commercial\s*Advertising/i,
      /Inappropriate\s*\/\s*Offensive\s*Language/i,
      /Suspicious Link\s*\/\s*Scam/i,
      /Select violation category/i,
      /Additional context/i,
    ];
    for (const pattern of hardcodedPatterns) {
      expect(cleaned).not.toMatch(pattern);
    }
  });
});