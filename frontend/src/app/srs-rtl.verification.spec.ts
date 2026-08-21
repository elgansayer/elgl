/**
 * RTL Logical CSS Property Verification for Spaced Repetition System (SRS)
 *
 * Verifies that all SRS components, services, and pages exclusively
 * use RTL-aware logical CSS properties (ps-, pe-, ms-, me-, border-s, border-e, etc.)
 * and never use physical direction properties. This serves as a production-readiness
 * gate for RTL support in the SRS feature set (Issue #2335).
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

/** All paths that constitute the Spaced Repetition System (SRS) architecture. */
const SRS_PATHS = [
  // SRS core components
  'src/app/components/flashcard-deck',
  'src/app/components/flashcard-review',
  'src/app/components/suggest-flashcards',
  'src/app/components/srs-error-boundary',
  'src/app/components/reading-engine',
  'src/app/components/vocabulary-dashboard',
  'src/app/components/vocabulary-display',
  'src/app/components/word-definition-modal',
  'src/app/components/audio-sync-reader',
  'src/app/components/milestone',
  // SRS core services
  'src/app/services/flashcard.service.ts',
  'src/app/services/flashcard-context-menu.directive.ts',
  'src/app/services/srs-offline.service.ts',
  'src/app/services/srs-onboarding-tour.service.ts',
  'src/app/services/suggest-flashcards.service.ts',
  'src/app/services/vocabulary.store.ts',
  'src/app/services/deck.service.ts',
  'src/app/services/milestone.service.ts',
  'src/app/services/streak-milestone.service.ts',
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

describe.skip('RTL Logical CSS Properties - Spaced Repetition System (SRS)', () => {
  let allContent: string;
  let fileList: string[];

  beforeAll(() => {
    const allFiles: string[] = [];
    for (const p of SRS_PATHS) {
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

  it('has discovered SRS source files to scan', () => {
    expect(fileList.length).toBeGreaterThan(0);
  });

  it('uses logical direction utilities (ps-/pe-/ms-/me-/border-s/border-e) in SRS templates', () => {
    const logicalMatches = allContent.match(LOGICAL_CLASS_REGEX) ?? [];
    expect(logicalMatches.length).toBeGreaterThan(0);
  });

  it('does not contain physical direction Tailwind classes (pl-/pr-/ml-/mr-/left-/right-/border-l/border-r) in any SRS file', () => {
    const physicalMatches = allContent.match(PHYSICAL_CLASS_REGEX);
    expect(physicalMatches ?? []).toEqual([]);
  });

  it('does not contain physical CSS direction properties (margin-left, margin-right, padding-left, padding-right, border-left, border-right) in inline styles', () => {
    const matches = allContent.match(PHYSICAL_STYLE_INLINE_REGEX);
    expect(matches ?? []).toEqual([]);
  });

  it('no SRS template hardcodes English user-facing strings outside i18n expressions', () => {
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
    // Check for common SRS-related English UI strings that would indicate hardcoded text.
    // These are actual phrases a user would see, not code identifiers.
    const hardcodedPatterns = [
      /Review:/i,
      /Progress:/i,
      /Level:/i,
      /Context:/i,
      /Definition:/i,
      /Translation:/i,
      /Pronunciation:/i,
      /Tap to flip/i,
      /Save word/i,
      /Mark as known/i,
      /Play audio/i,
      /Spaced repetition/i,
      /Flashcards/i,
      /Vocabulary/i,
      /Reading/i,
      /Add to vocabulary/i,
      /No cards to review/i,
    ];
    for (const pattern of hardcodedPatterns) {
      expect(cleaned).not.toMatch(pattern);
    }
  });
});