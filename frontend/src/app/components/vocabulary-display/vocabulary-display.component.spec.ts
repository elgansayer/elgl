import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { VocabularyDisplayComponent } from './vocabulary-display.component';
import { HobbyTagsStore } from '../../services/hobby-tags.store';
import { FlashcardService } from '../../services/flashcard.service';
import { I18nService } from '../../services/i18n.service';
import { signal } from '@angular/core';
import * as toastService from '../../services/toast.service';

describe('VocabularyDisplayComponent', () => {
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

  beforeEach(async () => {
    TestBed.resetTestingModule();
    mockCreateFlashcard.mockReset().mockResolvedValue({});
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
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(VocabularyDisplayComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  describe('addToFlashcards', () => {
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
});
