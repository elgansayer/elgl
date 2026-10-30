import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ChatService } from '../../services/chat.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { I18nService } from '../../services/i18n.service';
import { toastsSignal } from '../../services/toast.service';
import { TranslationCacheService } from '../../services/translation-cache.service';
import { VisualDiffComponent } from './visual-diff.component';

describe('VisualDiffComponent', () => {
  let fixture: ComponentFixture<VisualDiffComponent>;
  let component: VisualDiffComponent;
  const saveWord = vi.fn();
  const translateText = vi.fn();
  const cacheGet = vi.fn();
  const cacheSet = vi.fn();

  beforeEach(async () => {
    saveWord.mockReset();
    saveWord.mockResolvedValue(undefined);
    translateText.mockReset();
    translateText.mockResolvedValue({ translated_text: 'Translated' });
    cacheGet.mockReset();
    cacheGet.mockReturnValue(null);
    cacheSet.mockReset();
    toastsSignal.set([]);

    await TestBed.configureTestingModule({
      imports: [VisualDiffComponent],
      providers: [
        {
          provide: VocabularyStore,
          useValue: { saveWord },
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
          useValue: { translateText },
        },
        {
          provide: TranslationCacheService,
          useValue: { get: cacheGet, set: cacheSet },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VisualDiffComponent);
    component = fixture.componentInstance;
    // Both inputs are required, so the first render needs a value for each.
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

  it('should render added spans in the DOM', () => {
    setInputs('Hello', 'Hello World');

    const addedEls = fixture.nativeElement.querySelectorAll('[data-type="added"]');
    expect(addedEls.length).toBeGreaterThan(0);
  });

  it('should render removed spans in the DOM', () => {
    setInputs('Hello World', 'Hello');

    const removedEls = fixture.nativeElement.querySelectorAll('[data-type="removed"]');
    expect(removedEls.length).toBeGreaterThan(0);
  });

  it('creates a flashcard with the trimmed tutor explanation as context', async () => {
    fixture.componentRef.setInput('original', 'I goes to market yesterday.');
    fixture.componentRef.setInput('corrected', 'I went to the market yesterday.');
    fixture.componentRef.setInput('explanation', '  Use the past tense here.  ');

    await component.createFlashcard();

    expect(saveWord).toHaveBeenCalledWith({
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

    expect(saveWord).toHaveBeenCalledWith({
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

    expect(saveWord).toHaveBeenCalledWith({
      word_token: 'Hello, world',
      translation: 'Hello world',
      original_context: 'e'.repeat(1000),
    });
  });

  describe('mixed-direction text', () => {
    it('lets the browser resolve the direction of the compared text', () => {
      setInputs('مرحبا بك', 'مرحبا بكم');

      const diff = fixture.nativeElement.querySelector('div[dir="auto"]');
      expect(diff).not.toBeNull();
      expect(diff.querySelector('del[data-type="removed"]')?.textContent?.trim()).toBe('بك');
      expect(diff.querySelector('ins[data-type="added"]')?.textContent?.trim()).toBe('بكم');
    });

    it('lets the browser resolve the direction of the tutor explanation', () => {
      setInputs('I goes', 'I go');
      fixture.componentRef.setInput('explanation', 'يجب استخدام الفعل المناسب');
      fixture.detectChanges();

      const explanation = fixture.nativeElement.querySelector('span[dir="auto"]');
      expect(explanation?.textContent?.trim()).toBe('يجب استخدام الفعل المناسب');
    });

    it('marks changes with semantic insertion and deletion elements, not colour alone', () => {
      setInputs('Hello World', 'Hello there');

      expect(fixture.nativeElement.querySelector('ins[data-type="added"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('del[data-type="removed"]')).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector('del[data-type="removed"]').className,
      ).toContain('line-through');
    });
  });

  describe('explanation translation', () => {
    function showExplanation(): void {
      setInputs('I goes to school', 'I go to school');
      fixture.componentRef.setInput('explanation', 'Subject-verb agreement');
      fixture.componentRef.setInput('showActions', true);
      fixture.detectChanges();
    }

    function translateButton(): HTMLButtonElement {
      return fixture.nativeElement.querySelector('button[aria-label="moments.translate"]');
    }

    it('keeps the translate control reachable for keyboard and touch users', () => {
      showExplanation();

      const button = translateButton();
      expect(button).not.toBeNull();
      expect(button.type).toBe('button');
      expect(button.disabled).toBe(false);
      // A control that only appears on hover cannot be used with a keyboard or a touch screen.
      expect(button.className).not.toContain('opacity-0');
      expect(button.className).not.toContain('group-hover');
      expect(button.getAttribute('aria-pressed')).toBe('false');
    });

    it('translates the explanation into the interface language and announces it politely', async () => {
      showExplanation();

      translateButton().click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(translateText).toHaveBeenCalledWith('Subject-verb agreement', 'en');
      expect(cacheSet).toHaveBeenCalledWith('Subject-verb agreement', 'en', 'Translated');
      const status = fixture.nativeElement.querySelector('[role="status"]');
      const translated = status.querySelector('div[dir="auto"]');
      expect(translated.textContent.trim()).toBe('Translated');
      expect(translated.getAttribute('lang')).toBe('en');
      expect(translateButton().getAttribute('aria-pressed')).toBe('true');
    });

    it('hides the translation on the next activation without another request', async () => {
      showExplanation();

      translateButton().click();
      await fixture.whenStable();
      fixture.detectChanges();
      translateButton().click();
      fixture.detectChanges();

      expect(translateText).toHaveBeenCalledTimes(1);
      expect(fixture.nativeElement.querySelector('[role="status"] div')).toBeNull();
      expect(translateButton().getAttribute('aria-pressed')).toBe('false');
    });

    it('uses a cached translation without sending the explanation to the provider again', async () => {
      cacheGet.mockReturnValue('Cached translation');
      showExplanation();

      translateButton().click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(translateText).not.toHaveBeenCalled();
      expect(
        fixture.nativeElement.querySelector('[role="status"] div').textContent.trim(),
      ).toBe('Cached translation');
    });

    it('reports a translation failure with a translated message and keeps the explanation', async () => {
      translateText.mockRejectedValue(new Error('provider unavailable'));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      showExplanation();

      translateButton().click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(toastsSignal()).toEqual([
        expect.objectContaining({ message: 'moments.transError', type: 'error' }),
      ]);
      expect(fixture.nativeElement.textContent).toContain('Subject-verb agreement');
      expect(translateButton().disabled).toBe(false);
      expect(cacheSet).not.toHaveBeenCalled();
    });

    it('does not show an empty translation result', async () => {
      translateText.mockResolvedValue({ translated_text: '' });
      showExplanation();

      translateButton().click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[role="status"] div')).toBeNull();
      expect(cacheSet).not.toHaveBeenCalled();
    });
  });

  describe('flashcard feedback', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('original', 'I goes');
      fixture.componentRef.setInput('corrected', 'I go');
    });

    it('confirms a saved flashcard with a translated success message', async () => {
      await component.createFlashcard();

      expect(toastsSignal()).toEqual([
        expect.objectContaining({ message: 'correction.flashcardCreatedAlert', type: 'success' }),
      ]);
    });

    it('reports a failure with its own translation key instead of a raw or English fallback', async () => {
      saveWord.mockRejectedValue(new Error('storage unavailable'));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await component.createFlashcard();

      expect(toastsSignal()).toEqual([
        expect.objectContaining({ message: 'correction.flashcardError', type: 'error' }),
      ]);
    });

    it('hides the decorative symbol from the accessible name of the flashcard action', () => {
      fixture.componentRef.setInput('showActions', true);
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('button');
      const action = buttons[buttons.length - 1];
      expect(action.type).toBe('button');
      expect(action.querySelector('[aria-hidden="true"]')?.textContent).toBe('➕');
    });
  });
});
