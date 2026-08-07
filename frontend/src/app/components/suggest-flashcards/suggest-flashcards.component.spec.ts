import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

describe('SuggestFlashcardsComponent - RTL logical CSS compliance', () => {
  let templateContent: string;

  beforeAll(() => {
    const content = readFileSync(
      resolve(__dirname, 'suggest-flashcards.component.ts'),
      'utf-8',
    );
    const match = content.match(/template:\s*`([\s\S]*?)`\s*,/);
    templateContent = match ? match[1] : content;
  });

  it('should not contain any physical direction CSS utilities', () => {
    const violations = [
      /\bpl-\d/, /\bpr-\d/, /\bml-\d/, /\bmr-\d/,
      /\bleft-[0-9]/, /\bright-[0-9]/,
      /\bborder-l\b/, /\bborder-r\b/,
    ];
    for (const pattern of violations) {
      expect(templateContent).not.toMatch(pattern);
    }
  });

  it('should use logical inline start for padding (ps-)', () => {
    expect(templateContent).toMatch(/\bps-\d/);
  });

  it('should use logical inline end for padding (pe-)', () => {
    expect(templateContent).toMatch(/\bpe-\d/);
  });

  it('should use i18n translate pipe for all user-facing strings', () => {
    const keys = [
      'suggest_flashcards.title',
      'suggest_flashcards.placeholder',
      'suggest_flashcards.suggest_button',
      'suggest_flashcards.loading',
      'suggest_flashcards.error',
    ];
    for (const key of keys) {
      expect(templateContent).toContain("'" + key + "'");
    }
  });

  it('should not hardcode English user-facing strings', () => {
    expect(templateContent).not.toMatch(/Suggest flashcards from message/);
    expect(templateContent).not.toMatch(/Ask for word suggestions/);
    expect(templateContent).not.toMatch(/>Suggest</);
    expect(templateContent).not.toMatch(/>Loading</);
    expect(templateContent).not.toMatch(/Enter a message for suggestions/);
  });
});