import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VisualDiffComponent } from './visual-diff.component';
import { FlashcardService } from '../../services/flashcard.service';
import { I18nService } from '../../services/i18n.service';
import { ChatService } from '../../services/chat.service';
import { TranslationCacheService } from '../../services/translation-cache.service';

describe('VisualDiffComponent', () => {
  let fixture: ComponentFixture<VisualDiffComponent>;
  let component: VisualDiffComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VisualDiffComponent],
      providers: [
        {
          provide: FlashcardService,
          useValue: { createFlashcard: async () => undefined },
        },
        {
          provide: I18nService,
          useValue: {
            currentLang: () => 'en',
            translate: (key: string) => key,
          },
        },
        {
          provide: ChatService,
          useValue: { translateText: async () => ({ translated_text: '' }) },
        },
        {
          provide: TranslationCacheService,
          useValue: { get: () => null, set: () => undefined },
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

  it('should render additions and removals with semantic HTML', () => {
    setInputs('Hello old world', 'Hello new world');

    const addedEls = fixture.nativeElement.querySelectorAll('ins[data-type="added"]');
    const removedEls = fixture.nativeElement.querySelectorAll('del[data-type="removed"]');

    expect(addedEls.length).toBeGreaterThan(0);
    expect(removedEls.length).toBeGreaterThan(0);
  });
});
