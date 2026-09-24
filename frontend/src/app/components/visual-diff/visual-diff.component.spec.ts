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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VisualDiffComponent],
      providers: [
        {
          provide: FlashcardService,
          useValue: { createFlashcard: vi.fn().mockResolvedValue(undefined) },
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

  it('should treat case differences as unchanged', () => {
    setInputs('Hello', 'hello');

    const segments = component.segments();
    expect(segments.length).toBe(1);
    expect(segments[0].type).toBe('unchanged');
    expect(segments[0].text).toBe('hello');
  });

  it('should handle punctuation changes', () => {
    setInputs('Hello!', 'Hello?');

    const segments = component.segments();
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

  it('should handle non-Latin text (Arabic)', () => {
    const original = 'مرحبا';
    const corrected = 'مرحبا';
    setInputs(original, corrected);

    const segments = component.segments();
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.every((segment) => segment.type === 'unchanged')).toBe(true);
  });

  it('should render added text using the success visual contract', () => {
    setInputs('Hello', 'Hello World');

    const addedEls = fixture.nativeElement.querySelectorAll('[data-type="added"]');
    expect(addedEls.length).toBeGreaterThan(0);
    expect(Array.from(addedEls).every((element) => (element as HTMLElement).classList.contains('text-success'))).toBe(true);
  });

  it('should render removed text with danger styling and strikethrough', () => {
    setInputs('Hello World', 'Hello');

    const removedEls = fixture.nativeElement.querySelectorAll('[data-type="removed"]');
    expect(removedEls.length).toBeGreaterThan(0);
    expect(Array.from(removedEls).every((element) => (element as HTMLElement).classList.contains('text-danger'))).toBe(true);
    expect(Array.from(removedEls).every((element) => (element as HTMLElement).classList.contains('line-through'))).toBe(true);
  });
});
