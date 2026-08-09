import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ErrorHandler } from '@angular/core';
import { VocabularyDisplayComponent } from './vocabulary-display.component';
import { HobbyTagsStore } from '../../services/hobby-tags.store';
import { FlashcardService } from '../../services/flashcard.service';
import { I18nService } from '../../services/i18n.service';
import { signal } from '@angular/core';
import * as toastService from '../../services/toast.service';

describe.skip('VocabularyDisplayComponent', () => {
  const mockCreateFlashcard = vi.fn().mockResolvedValue({});
  const mockFlashcardService = { createFlashcard: mockCreateFlashcard };
  const mockI18n = {
    translate: vi.fn((key: string, params?: Record<string, string>) => {
      if (key === 'vocabDisplay.contextSentence') return `Vocabulary from hobby: ${params?.['tag'] ?? ''}`;
      if (key === 'vocabDisplay.addSuccess') return 'Added to flashcards successfully';
      if (key === 'vocabDisplay.addError') return 'Failed to add to flashcards';
      return key;
    }),
  };
  const mockErrorHandler = { handleError: vi.fn() };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    mockCreateFlashcard.mockReset().mockResolvedValue({});
    mockErrorHandler.handleError.mockReset();
    vi.clearAllMocks();
    const mockStore = {
      loading: signal(false),
      vocabularyByTag: signal(new Map([['tag1', [{ word: 'test', translation: 'prueba', hobbyTagName: 'tag1' }]]])),
      allTags: signal([]),
      loadVocabulary: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [VocabularyDisplayComponent],
      providers: [
        { provide: HobbyTagsStore, useValue: mockStore },
        { provide: FlashcardService, useValue: mockFlashcardService },
        { provide: I18nService, useValue: mockI18n },
        { provide: ErrorHandler, useValue: mockErrorHandler },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(VocabularyDisplayComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should provide error context with tag count', () => {
    const fixture = TestBed.createComponent(VocabularyDisplayComponent);
    const component = fixture.componentInstance;

    const ctx = component.errorContext();
    expect(ctx.component).toBe('vocabulary-display');
    expect(ctx.operation).toBe('display');
    expect(ctx.metadata).toBeDefined();
  });

  describe.skip('addToFlashcards', () => {
    const item = { word: 'hello', translation: 'hola', hobbyTagName: 'Spanish' };

    it('should call flashcardService.createFlashcard with correct dto', async () => {
      const fixture = TestBed.createComponent(VocabularyDisplayComponent);
      const component = fixture.componentInstance;

      await component.addToFlashcards(item);

      expect(mockCreateFlashcard).toHaveBeenCalledOnce();
      expect(mockCreateFlashcard).toHaveBeenCalledWith({
        word: 'hello',
        sourceLanguage: 'en',
        contextSentence: 'Vocabulary from hobby: Spanish',
        translation: 'hola',
      });
    });

    it('should show success toast when flashcard is created', async () => {
      const showToastSpy = vi.spyOn(toastService, 'showToast');
      const fixture = TestBed.createComponent(VocabularyDisplayComponent);
      const component = fixture.componentInstance;

      await component.addToFlashcards(item);

      expect(showToastSpy).toHaveBeenCalledWith('Added to flashcards successfully', 'success');
      showToastSpy.mockRestore();
    });

    it('should show error toast when flashcard creation fails', async () => {
      const showErrorToastSpy = vi.spyOn(toastService, 'showErrorToast');
      mockCreateFlashcard.mockRejectedValueOnce(new Error('Network error'));
      const fixture = TestBed.createComponent(VocabularyDisplayComponent);
      const component = fixture.componentInstance;

      await component.addToFlashcards(item);

      expect(showErrorToastSpy).toHaveBeenCalledWith('Failed to add to flashcards');
      showErrorToastSpy.mockRestore();
    });
  });

  describe('RTL logical CSS properties', () => {
    it('should use logical padding (ps-/pe-) instead of physical (pl-/pr-)', () => {
      const fixture = TestBed.createComponent(VocabularyDisplayComponent);
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML;
      expect(html).toContain('ps-');
      expect(html).toContain('pe-');
      expect(html).not.toMatch(/\b(pl-\d|pr-\d)\b/);
    });

    it('should use logical margin (ms-/me-) instead of physical (ml-/mr-)', () => {
      const fixture = TestBed.createComponent(VocabularyDisplayComponent);
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML;
      expect(html).not.toMatch(/\b(ml-\d|mr-\d)\b/);
    });

    it('should not contain text-left or text-right classes', () => {
      const fixture = TestBed.createComponent(VocabularyDisplayComponent);
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML;
      expect(html).not.toContain('text-left');
      expect(html).not.toContain('text-right');
    });
  });
});
