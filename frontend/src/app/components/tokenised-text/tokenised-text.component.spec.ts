import { ErrorHandler, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TokenisedTextComponent,
  tokeniseText,
  type TokenSegment,
} from './tokenised-text.component';
import { VocabularyStore } from '../../services/vocabulary.store';
import { I18nService } from '../../services/i18n.service';
import { TransliterationService } from '../../services/transliteration.service';
import { FlashcardService } from '../../services/flashcard.service';
import { ChatService } from '../../services/chat.service';

class FailingLocaleSegmenter {
  constructor(locale?: string | string[]) {
    if (locale) throw new RangeError('Unsupported locale');
  }

  segment(text: string): Intl.Segments {
    return new Intl.Segmenter('en', { granularity: 'word' }).segment(text);
  }
}

describe('tokeniseText', () => {
  it('segments English words with native word granularity and stable source indexes', () => {
    const tokens = tokeniseText('Hello world', 'en');

    expect(tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ segment: 'Hello', isWordLike: true, index: 0 }),
        expect.objectContaining({ segment: ' ', isWordLike: false, index: 5 }),
        expect.objectContaining({ segment: 'world', isWordLike: true, index: 6 }),
      ]),
    );
  });

  it('supports non-Latin word segmentation', () => {
    const tokens = tokeniseText('日本語を勉強する', 'ja');

    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.some((token) => token.isWordLike)).toBe(true);
    expect(tokens.map((token) => token.segment).join('')).toBe('日本語を勉強する');
  });

  it('preserves the original text as non-interactive when Segmenter is unavailable', () => {
    expect(tokeniseText('Keep this readable', 'en', undefined)).toEqual([
      { segment: 'Keep this readable', isWordLike: false, index: 0 },
    ]);
  });

  it('retries with the runtime default locale when the requested locale is invalid', () => {
    const tokens = tokeniseText(
      'Fallback works',
      'invalid-locale',
      FailingLocaleSegmenter as unknown as typeof Intl.Segmenter,
    );

    expect(tokens.map((token) => token.segment).join('')).toBe('Fallback works');
    expect(tokens.filter((token) => token.isWordLike).map((token) => token.segment)).toEqual([
      'Fallback',
      'works',
    ]);
  });

  it('returns no tokens for empty text', () => {
    expect(tokeniseText('', 'en')).toEqual([]);
  });
});

describe('TokenisedTextComponent', () => {
  let fixture: ComponentFixture<TokenisedTextComponent>;
  let component: TokenisedTextComponent;

  const vocabStore = {
    getWordStatus: vi.fn(() => ({ colourClass: 'known-token' })),
  };
  const i18n = {
    translate: vi.fn((key: string) => key),
    currentLang: signal('en'),
  };
  const transliterationService = {
    transliterate: vi.fn(() => ''),
  };
  const flashcardService = {
    createFlashcard: vi.fn(),
  };
  const chatService = {
    translateText: vi.fn(),
  };
  const errorHandler = {
    handleError: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    transliterationService.transliterate.mockReturnValue('');

    await TestBed.configureTestingModule({
      imports: [TokenisedTextComponent],
      providers: [
        { provide: VocabularyStore, useValue: vocabStore },
        { provide: I18nService, useValue: i18n },
        { provide: TransliterationService, useValue: transliterationService },
        { provide: FlashcardService, useValue: flashcardService },
        { provide: ChatService, useValue: chatService },
        { provide: ErrorHandler, useValue: errorHandler },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TokenisedTextComponent);
    component = fixture.componentInstance;
  });

  function render(text: string, language = 'en'): HTMLElement {
    fixture.componentRef.setInput('text', text);
    fixture.componentRef.setInput('language', language);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function tokenHost(root: HTMLElement): HTMLElement {
    const host = root.querySelector<HTMLElement>('div[dir="auto"]');
    if (!host) throw new Error('Token host was not rendered');
    return host;
  }

  it('renders word-like tokens as keyboard-focusable buttons without making punctuation interactive', () => {
    const root = render('Hello, world!');
    const spans = [...tokenHost(root).querySelectorAll<HTMLElement>(':scope > span')];
    const hello = spans.find((span) => span.textContent?.trim() === 'Hello');
    const punctuation = spans.find((span) => span.textContent?.includes(','));

    expect(hello).toBeTruthy();
    expect(hello?.getAttribute('role')).toBe('button');
    expect(hello?.getAttribute('tabindex')).toBe('0');
    expect(punctuation).toBeTruthy();
    expect(punctuation?.hasAttribute('role')).toBe(false);
    expect(punctuation?.hasAttribute('tabindex')).toBe(false);
    expect(tokenHost(root).getAttribute('dir')).toBe('auto');
  });

  it('emits the clicked word and full source context only for word-like tokens', () => {
    render('Hello world');
    const emitted = vi.fn();
    component.wordClicked.subscribe(emitted);

    component.onTokenClick({ segment: 'Hello', isWordLike: true, index: 0 });
    component.onTokenClick({ segment: ' ', isWordLike: false, index: 5 });

    expect(emitted).toHaveBeenCalledTimes(1);
    expect(emitted).toHaveBeenCalledWith({ token: 'Hello', context: 'Hello world' });
  });

  it('supports Enter and Space keyboard activation for rendered word tokens', () => {
    const root = render('Hello');
    const emitted = vi.fn();
    component.wordClicked.subscribe(emitted);
    const token = tokenHost(root).querySelector<HTMLElement>('[role="button"]');

    token?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    token?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    expect(emitted).toHaveBeenCalledTimes(2);
    expect(emitted).toHaveBeenNthCalledWith(1, { token: 'Hello', context: 'Hello' });
    expect(emitted).toHaveBeenNthCalledWith(2, { token: 'Hello', context: 'Hello' });
  });

  it('keeps token rendering available when transliteration fails', () => {
    transliterationService.transliterate.mockImplementation(() => {
      throw new Error('provider unavailable');
    });

    const root = render('こんにちは', 'ja');

    expect(component.tokens().map((token) => token.segment).join('')).toBe('こんにちは');
    expect(component.transliteration()).toBe('');
    expect(tokenHost(root).textContent).toContain('こんにちは');
  });

  it('does not emit non-word fallback segments', () => {
    const emitted = vi.fn();
    component.wordClicked.subscribe(emitted);
    const fallback: TokenSegment = {
      segment: 'Readable fallback',
      isWordLike: false,
      index: 0,
    };

    component.onTokenClick(fallback);

    expect(emitted).not.toHaveBeenCalled();
  });
});
