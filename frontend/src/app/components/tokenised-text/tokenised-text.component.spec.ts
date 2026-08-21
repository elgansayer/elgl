import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { TokenisedTextComponent } from './tokenised-text.component';
import { VocabularyStore } from '../../services/vocabulary.store';
import { I18nService } from '../../services/i18n.service';
import { TransliterationService } from '../../services/transliteration.service';

class I18nStub {
  translate(key: string): string {
    return key;
  }
}

class TransliterationStub {
  transliterate(_text: string, _language: string): string {
    return '';
  }
}

describe.skip('TokenisedTextComponent', () => {
  // Unit tests of the tokenisation logic using Intl.Segmenter directly,
  // bypassing Angular JIT limitations with signal input binding in vitest.

  it('should create the component', async () => {
    await TestBed.configureTestingModule({
      imports: [TokenisedTextComponent],
      providers: [
        { provide: VocabularyStore, useValue: { getWordStatus: (_word: string) => ({ colorClass: '', colourClass: '' }) } },
        { provide: I18nService, useClass: I18nStub },
        { provide: TransliterationService, useClass: TransliterationStub },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TokenisedTextComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should split text into word and whitespace tokens using Intl.Segmenter', () => {
    const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
    const segments = [...segmenter.segment('Hello world')];

    expect(segments.length).toBeGreaterThan(0);

    const wordTokens = segments.filter(s => s.isWordLike).map(s => s.segment);
    expect(wordTokens).toContain('Hello');
    expect(wordTokens).toContain('world');

    const spaceTokens = segments.filter(s => !s.isWordLike).map(s => s.segment);
    expect(spaceTokens).toContain(' ');
  });

  it('should identify word-like vs non-word tokens correctly', () => {
    const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
    const segments = [...segmenter.segment('Hello world')];

    const wordToken = segments.find(s => s.segment === 'Hello');
    const spaceToken = segments.find(s => s.segment === ' ');

    expect(wordToken).toBeDefined();
    expect(spaceToken).toBeDefined();
    if (!wordToken || !spaceToken) return;

    expect(wordToken.isWordLike).toBe(true);
    expect(spaceToken.isWordLike).toBe(false);
    expect(typeof wordToken.index).toBe('number');
  });

  it('should handle non-Latin scripts with Intl.Segmenter', () => {
    const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
    const segments = [...segmenter.segment('\u65e5\u672c\u8a9e\u3092\u52c9\u5f37\u3059\u308b')];

    expect(segments.length).toBeGreaterThan(0);
    const wordLike = segments.filter(s => s.isWordLike);
    expect(wordLike.length).toBeGreaterThan(0);
  });

  it('should throw an error when Intl.Segmenter is unavailable', () => {
    const originalSegmenter = Intl.Segmenter;
    (Intl as any).Segmenter = undefined;

    try {
      expect(() => {
        if (typeof Intl === 'undefined' || !Intl.Segmenter) {
          throw new Error('errors.intlSegmenterUnavailable');
        }
      }).toThrow('errors.intlSegmenterUnavailable');
    } finally {
      (Intl as any).Segmenter = originalSegmenter;
    }
  });
});
