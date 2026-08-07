import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

describe('FlashcardDeckComponent - RTL logical CSS compliance', () => {
  let templateContent: string;

  beforeAll(() => {
    const content = readFileSync(
      resolve(__dirname, 'flashcard-deck.component.ts'),
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

  it('should use logical margin start (ms-) where needed', () => {
    expect(templateContent).toMatch(/\bms-\d/);
  });

  it('should use i18n translate pipe for all user-facing strings', () => {
    const keys = [
      'deck.title', 'deck.subtitle', 'deck.browseBtn',
      'deck.cancelBtn', 'deck.createBtn', 'deck.countLabel',
      'deck.createTitle', 'deck.nameLabel', 'deck.namePlaceholder',
      'deck.descriptionLabel', 'deck.descriptionPlaceholder',
      'deck.colourLabel', 'deck.iconLabel', 'deck.saveBtn',
      'deck.loading', 'deck.emptyTitle', 'deck.emptyDesc',
      'deck.cardCount', 'deck.backBtn', 'deck.editBtn',
      'deck.startReview', 'deck.editTitle', 'deck.addCardsTitle',
      'deck.noCardsAvailable', 'deck.addBtn',
    ];
    for (const key of keys) {
      expect(templateContent).toContain("'" + key + "'");
    }
  });

  it('should not hardcode English user-facing strings', () => {
    expect(templateContent).not.toMatch(/Create Deck/);
    expect(templateContent).not.toMatch(/Browse Decks/);
    expect(templateContent).not.toMatch(/Deck Name/);
    expect(templateContent).not.toMatch(/Description/);
    expect(templateContent).not.toMatch(/Cancel/);
    expect(templateContent).not.toMatch(/Save/);
    expect(templateContent).not.toMatch(/Loading/);
    expect(templateContent).not.toMatch(/Back/);
    expect(templateContent).not.toMatch(/Edit/);
    expect(templateContent).not.toMatch(/Start Review/);
  });
});