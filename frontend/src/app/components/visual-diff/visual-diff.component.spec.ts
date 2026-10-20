import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ChatService } from '../../services/chat.service';
import { FlashcardService } from '../../services/flashcard.service';
import { I18nService } from '../../services/i18n.service';
import { TranslationCacheService } from '../../services/translation-cache.service';
import { VisualDiffComponent } from './visual-diff.component';

describe('VisualDiffComponent', () => {
  let fixture: ComponentFixture<VisualDiffComponent>;
  let component: VisualDiffComponent;
  const createFlashcard = vi.fn();

  beforeEach(async () => {
    createFlashcard.mockReset();
    createFlashcard.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [VisualDiffComponent],
      providers: [
        {
          provide: FlashcardService,
          useValue: { createFlashcard },
        },
        {
          provide: I18nService,
          useValue: {
            currentLang: signal('en'),
            translate: (key: string) => key,
          },
        },
        {
          provide: ChatService,
          useValue: { translateText: vi.fn().mockResolvedValue({ translated_text: 'Translated' }) },
        },
        {
          provide: TranslationCacheService,
          useValue: {
            get: vi.fn().mockReturnValue(null),
            set: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VisualDiffComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('original', '');
    fixture.componentRef.setInput('corrected', '');
    fixture.detectChanges();
  });

  function setInputs(original: string, corrected: string): void {
    fixture.componentRef.setInput('original', original);
    fixture.componentRef.setInput('corrected', corrected);
    fixture.detectChanges();
  }

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should produce unchanged segments when original equals corrected', () => {
    setInputs('Hello world', 'Hello world');

    const segments = component.segments();
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.every((segment) => segment.type === 'unchanged')).toBe(true);
  });

  it('should mark added tokens when corrected text expands original', () => {
    setInputs('Hello', 'Hello World');

    const segments = component.segments();
    expect(segments.some((segment) => segment.type === 'added')).toBe(true);
    expect(segments.some((segment) => segment.type === 'removed')).toBe(false);
  });

  it('should mark removed tokens when original text contains extra content', () => {
    setInputs('Hello World', 'Hello');

    const segments = component.segments();
    expect(segments.some((segment) => segment.type === 'removed')).toBe(true);
    expect(segments.some((segment) => segment.type === 'added')).toBe(false);
  });

  it('should treat case differences as unchanged while preserving corrected casing', () => {
    setInputs('Hello', 'hello');

    const segments = component.segments();
    expect(segments).toHaveLength(1);
    expect(segments[0]?.type).toBe('unchanged');
    expect(segments[0]?.text).toBe('hello');
  });

  it('should handle punctuation substitutions as removals and additions', () => {
    setInputs('Hello!', 'Hello?');

    const segments = component.segments();
    expect(segments.some((segment) => segment.type === 'removed' && segment.text === '!')).toBe(
      true,
    );
    expect(segments.some((segment) => segment.type === 'added' && segment.text === '?')).toBe(true);
  });

  it('should align multiple consecutive replacements without the old lookahead heuristic', () => {
    const original = 'I really like learning Japanese every day';
    const corrected = 'I really enjoy studying Japanese every day';
    setInputs(original, corrected);

    const segments = component.segments();
    const removedText = segments
      .filter((segment) => segment.type === 'removed')
      .map((segment) => segment.text)
      .join('');
    const addedText = segments
      .filter((segment) => segment.type === 'added')
      .map((segment) => segment.text)
      .join('');

    expect(removedText).toContain('like');
    expect(removedText).toContain('learning');
    expect(addedText).toContain('enjoy');
    expect(addedText).toContain('studying');
    expect(
      segments
        .filter((segment) => segment.type !== 'removed')
        .map((segment) => segment.text)
        .join(''),
    ).toBe(corrected);
  });

  it('should preserve repeated tokens while producing a valid edit sequence', () => {
    const original = 'very very good';
    const corrected = 'very good very';
    setInputs(original, corrected);

    const segments = component.segments();
    const originalReconstruction = segments
      .filter((segment) => segment.type !== 'added')
      .map((segment) => segment.text)
      .join('');
    const correctedReconstruction = segments
      .filter((segment) => segment.type !== 'removed')
      .map((segment) => segment.text)
      .join('');

    expect(originalReconstruction).toBe(original);
    expect(correctedReconstruction).toBe(corrected);
    expect(segments.some((segment) => segment.type === 'removed')).toBe(true);
    expect(segments.some((segment) => segment.type === 'added')).toBe(true);
  });

  it('should produce monotonic indexes', () => {
    setInputs('Hello beautiful World', 'Hello World');

    const segments = component.segments();
    const indexes = segments.map((segment) => segment.index);
    expect(new Set(indexes).size).toBe(indexes.length);
    for (let i = 0; i < indexes.length - 1; i++) {
      expect(indexes[i]).toBeLessThan(indexes[i + 1]);
    }
  });

  it('should handle non-Latin text', () => {
    setInputs('مرحبا بالعالم', 'مرحبا بالعالم');

    const segments = component.segments();
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.every((segment) => segment.type === 'unchanged')).toBe(true);
  });

  it('preserves complete long texts with a bounded replacement instead of a quadratic diff', () => {
    const original = 'old word '.repeat(600);
    const corrected = 'new text '.repeat(600);
    setInputs(original, corrected);

    expect(component.segments()).toEqual([
      { type: 'removed', text: original, index: 0 },
      { type: 'added', text: corrected, index: 1 },
    ]);
    expect(fixture.nativeElement.querySelectorAll('[data-type]')).toHaveLength(2);
  });

  it('keeps identical long text unchanged without rendering a token for every word', () => {
    const text = '同じ文章 unchanged '.repeat(600);
    setInputs(text, text);

    expect(component.segments()).toEqual([{ type: 'unchanged', text, index: 0 }]);
    expect(fixture.nativeElement.querySelectorAll('[data-type]')).toHaveLength(1);
  });

  it('should render added text using the success visual contract', () => {
    setInputs('Hello', 'Hello World');

    const addedEls = fixture.nativeElement.querySelectorAll('[data-type="added"]');
    expect(addedEls.length).toBeGreaterThan(0);
    expect(
      Array.from(addedEls).every((element) =>
        (element as HTMLElement).classList.contains('text-success'),
      ),
    ).toBe(true);
  });

  it('should render removed text with danger styling and strikethrough', () => {
    setInputs('Hello World', 'Hello');

    const removedEls = fixture.nativeElement.querySelectorAll('[data-type="removed"]');
    expect(removedEls.length).toBeGreaterThan(0);
    expect(
      Array.from(removedEls).every((element) =>
        (element as HTMLElement).classList.contains('text-danger'),
      ),
    ).toBe(true);
    expect(
      Array.from(removedEls).every((element) =>
        (element as HTMLElement).classList.contains('line-through'),
      ),
    ).toBe(true);
  });

  it('should render additions and removals with semantic HTML', () => {
    setInputs('Hello old world', 'Hello new world');

    const addedEls = fixture.nativeElement.querySelectorAll('ins[data-type="added"]');
    const removedEls = fixture.nativeElement.querySelectorAll('del[data-type="removed"]');

    expect(addedEls.length).toBeGreaterThan(0);
    expect(removedEls.length).toBeGreaterThan(0);
    expect(
      Array.from(removedEls).every((element) =>
        (element as HTMLElement).classList.contains('text-danger'),
      ),
    ).toBe(true);
    expect(
      Array.from(removedEls).every((element) =>
        (element as HTMLElement).classList.contains('line-through'),
      ),
    ).toBe(true);
  });

  it('creates a flashcard with the trimmed tutor explanation as context', async () => {
    fixture.componentRef.setInput('original', 'I goes to market yesterday.');
    fixture.componentRef.setInput('corrected', 'I went to the market yesterday.');
    fixture.componentRef.setInput('explanation', '  Use the past tense here.  ');

    await component.createFlashcard();

    expect(createFlashcard).toHaveBeenCalledWith({
      word_token: 'I went to the market yesterday.',
      translation: 'I goes to market yesterday.',
      original_context: 'Use the past tense here.',
    });
  });

  it('omits whitespace-only context and retains the field-specific SRS limits', async () => {
    fixture.componentRef.setInput('original', 'o'.repeat(600));
    fixture.componentRef.setInput('corrected', 'c'.repeat(300));
    fixture.componentRef.setInput('explanation', '   ');

    await component.createFlashcard();

    expect(createFlashcard).toHaveBeenCalledWith({
      word_token: 'c'.repeat(200),
      translation: 'o'.repeat(500),
      original_context: undefined,
    });
  });

  it('limits tutor context independently to 1000 characters', async () => {
    fixture.componentRef.setInput('original', 'Hello world');
    fixture.componentRef.setInput('corrected', 'Hello, world');
    fixture.componentRef.setInput('explanation', '  ' + 'e'.repeat(1100) + '  ');

    await component.createFlashcard();

    expect(createFlashcard).toHaveBeenCalledWith({
      word_token: 'Hello, world',
      translation: 'Hello world',
      original_context: 'e'.repeat(1000),
    });
  });
});
