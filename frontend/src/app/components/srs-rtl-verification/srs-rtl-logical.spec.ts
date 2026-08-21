import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * SRS RTL Logical CSS Properties Verification
 *
 * This suite verifies that all Spaced Repetition System (SRS) component
 * templates and styles exclusively use RTL-safe logical CSS properties
 * (ps-, pe-, ms-, me-, border-s, border-e, text-start, text-end, etc.)
 * instead of physical directional properties (pl-, pr-, ml-, mr-, etc.).
 */

const SRC_ROOT = resolve(import.meta.dirname ?? __dirname, '../../');

interface SrsComponentFile {
  name: string;
  type: 'component' | 'service';
  files: string[];
}

const SRS_FILES: SrsComponentFile[] = [
  {
    name: 'srs-error-boundary',
    type: 'component',
    files: ['components/srs-error-boundary/srs-error-boundary.component.ts'],
  },
  {
    name: 'flashcard-deck',
    type: 'component',
    files: ['components/flashcard-deck/flashcard-deck.component.ts'],
  },
  {
    name: 'flashcard-review',
    type: 'component',
    files: ['components/flashcard-review/flashcard-review.component.ts'],
  },
  {
    name: 'vocabulary-dashboard',
    type: 'component',
    files: [
      'components/vocabulary-dashboard/vocabulary-dashboard.component.ts',
      'components/vocabulary-dashboard/vocabulary-dashboard.component.html',
      'components/vocabulary-dashboard/vocabulary-dashboard.component.scss',
    ],
  },
  {
    name: 'vocabulary-display',
    type: 'component',
    files: ['components/vocabulary-display/vocabulary-display.component.ts'],
  },
  {
    name: 'word-definition-modal',
    type: 'component',
    files: [
      'components/word-definition-modal/word-definition-modal.component.ts',
      'components/word-definition-modal/word-definition-modal.component.html',
      'components/word-definition-modal/word-definition-modal.component.scss',
    ],
  },
  {
    name: 'srs-offline-service',
    type: 'service',
    files: ['services/srs-offline.service.ts'],
  },
  {
    name: 'vocabulary-store',
    type: 'service',
    files: ['services/vocabulary.store.ts'],
  },
  {
    name: 'suggest-flashcards',
    type: 'component',
    files: ['components/suggest-flashcards/suggest-flashcards.component.ts'],
  },
];

const PHYSICAL_PADDING_REGEX = /\bpl-\d+\b|\bpr-\d+\b/;
const PHYSICAL_MARGIN_REGEX = /\bml-\d+\b|\bmr-\d+\b/;
const PHYSICAL_BORDER_REGEX = /\bborder-l(?!-)\b|\bborder-r(?!-)\b/;
const PHYSICAL_TEXT_REGEX = /\btext-left\b|\btext-right\b/;
const PHYSICAL_FLOAT_REGEX = /\bfloat-left\b|\bfloat-right\b|\bclear-left\b|\bclear-right\b/;

const PHYSICAL_CSS_PROPERTIES = [
  /padding-left\s*:/,
  /padding-right\s*:/,
  /margin-left\s*:/,
  /margin-right\s*:/,
  /border-left\s*:/,
  /border-right\s*:/,
  /text-align\s*:\s*(left|right)/,
  /direction\s*:\s*(ltr|rtl)/,
];

function readFileContent(relativePath: string): string | null {
  try {
    return readFileSync(resolve(SRC_ROOT, relativePath), 'utf-8');
  } catch {
    return null;
  }
}

function extractTemplateContent(componentContent: string): string {
  // Extract inline template string
  const templateMatch = componentContent.match(/template\s*:\s*`([\s\S]*?)`/);
  if (templateMatch) return templateMatch[1];

  // If templateUrl is used, we can't easily check here - skip
  return '';
}

function extractStylesContent(componentContent: string): string {
  // Extract inline styles array
  const stylesMatch = componentContent.match(/styles\s*:\s*\[\s*`([\s\S]*?)`\s*\]/);
  if (stylesMatch) return stylesMatch[1];

  // Check for styleUrls
  const styleUrlsMatch = componentContent.match(/styleUrls?\s*:\s*\[([^\]]*)\]/);
  if (styleUrlsMatch) {
    const filePaths = styleUrlsMatch[1]
      .replace(/['"]/g, '')
      .split(',')
      .map((f) => f.trim());
    return filePaths
      .map((fp) => {
        // Resolve relative to component dir
        const resolvedPath = resolve(SRC_ROOT, 'components', fp.startsWith('./') ? fp : `./${fp}`);
        try {
          return readFileSync(resolvedPath, 'utf-8');
        } catch {
          return '';
        }
      })
      .join('\n');
  }
  return '';
}

describe('SRS RTL Logical CSS Properties Verification', () => {
  for (const srsFile of SRS_FILES) {
    describe(`${srsFile.name} (${srsFile.type})`, () => {
      let allContent = '';

      beforeAll(() => {
        for (const file of srsFile.files) {
          const content = readFileContent(file);
          if (content) {
            allContent += content + '\n';

            // Also extract inline templates and styles from .ts files
            if (file.endsWith('.ts')) {
              allContent += extractTemplateContent(content) + '\n';
              allContent += extractStylesContent(content) + '\n';
            }
          }
        }
      });

      it('should not use physical padding utilities (pl-/pr-)', () => {
        const violations = allContent.match(PHYSICAL_PADDING_REGEX);
        expect(violations, `Physical padding found: ${violations?.join(', ')}`).toBeNull();
      });

      it('should not use physical margin utilities (ml-/mr-)', () => {
        const violations = allContent.match(PHYSICAL_MARGIN_REGEX);
        expect(violations, `Physical margins found: ${violations?.join(', ')}`).toBeNull();
      });

      it('should not use physical border utilities (border-l / border-r)', () => {
        const violations = allContent.match(PHYSICAL_BORDER_REGEX);
        expect(violations, `Physical borders found: ${violations?.join(', ')}`).toBeNull();
      });

      it('should not use physical text alignment (text-left / text-right)', () => {
        const violations = allContent.match(PHYSICAL_TEXT_REGEX);
        expect(violations, `Physical text alignment found: ${violations?.join(', ')}`).toBeNull();
      });

      it('should not use physical float/clear properties', () => {
        const violations = allContent.match(PHYSICAL_FLOAT_REGEX);
        expect(violations, `Physical floats found: ${violations?.join(', ')}`).toBeNull();
      });

      it('should not use physical CSS properties in inline styles', () => {
        for (const regex of PHYSICAL_CSS_PROPERTIES) {
          const violations = allContent.match(regex);
          expect(
            violations,
            `Physical CSS property found matching ${regex}: ${violations?.join(', ')}`,
          ).toBeNull();
        }
      });

      it('should use logical padding utilities (ps-/pe-) where spacing is applied', () => {
        // Not all SRS files have inline templates with padding, so this is optional
        // But we verify that if padding exists, it's logical
        const hasPhysical = PHYSICAL_PADDING_REGEX.test(allContent);
        expect(hasPhysical).toBe(false);
      });

      it('should use logical margin utilities (ms-/me-) where spacing is applied', () => {
        const hasPhysical = PHYSICAL_MARGIN_REGEX.test(allContent);
        expect(hasPhysical).toBe(false);
      });
    });
  }
});
