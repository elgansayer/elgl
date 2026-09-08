import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ErrorHandler } from '@angular/core';
import { SuggestFlashcardsComponent } from './suggest-flashcards.component';
import { SuggestFlashcardsService } from '../../services/suggest-flashcards.service';
import { I18nService } from '../../services/i18n.service';
import { VocabularyStore } from '../../services/vocabulary.store';

describe('SuggestFlashcardsComponent', () => {
  let fixture: ComponentFixture<SuggestFlashcardsComponent>;
  let component: SuggestFlashcardsComponent;
  let mockSuggestService: { suggestFromMessage: ReturnType<typeof vi.fn> };
  let mockVocabStore: { saveWord: ReturnType<typeof vi.fn> };
  let mockErrorHandler: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();

    mockSuggestService = {
      suggestFromMessage: vi.fn().mockResolvedValue({ suggestions: ['word1', 'word2'] }),
    };
    mockVocabStore = {
      saveWord: vi.fn().mockResolvedValue({ id: 'abc', word_token: 'word1' }),
    };
    mockErrorHandler = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SuggestFlashcardsComponent],
      providers: [
        { provide: SuggestFlashcardsService, useValue: mockSuggestService },
        { provide: VocabularyStore, useValue: mockVocabStore },
        {
          provide: I18nService,
          useValue: {
            translate: vi.fn((key: string) => {
              if (key === 'suggest_flashcards.error') return 'Failed to suggest flashcards';
              return key;
            }),
          },
        },
        { provide: ErrorHandler, useValue: mockErrorHandler },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SuggestFlashcardsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates with an empty initial state', () => {
    expect(component).toBeTruthy();
    expect(component.suggestions()).toEqual([]);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
    expect(component.hasAttempted()).toBe(false);
  });

  it('provides privacy-safe error context metadata', () => {
    component.messageInput.set('test message');

    const context = component.errorContext();

    expect(context.component).toBe('suggest-flashcards');
    expect(context.operation).toBe('suggest');
    expect(context.metadata).toEqual({
      messageLength: 12,
      hasExternalMessage: false,
    });
  });

  it('requests suggestions without a caller-controlled user id', async () => {
    component.messageInput.set('Hello world');

    await component.manualSuggest();

    expect(mockSuggestService.suggestFromMessage).toHaveBeenCalledWith(
      'Hello world',
      undefined,
      true,
    );
    expect(component.suggestions()).toEqual(['word1', 'word2']);
    expect(component.hasAttempted()).toBe(true);
    expect(component.loading()).toBe(false);
  });

  it('passes the configured target language to segmentation', async () => {
    fixture.componentRef.setInput('externalTargetLanguage', 'ja');
    fixture.detectChanges();
    component.messageInput.set('こんにちは世界');

    await component.manualSuggest();

    expect(mockSuggestService.suggestFromMessage).toHaveBeenCalledWith(
      'こんにちは世界',
      'ja',
      true,
    );
  });

  it('sets a translated retryable error on suggestion failure', async () => {
    mockSuggestService.suggestFromMessage.mockRejectedValueOnce(new Error('API error'));
    component.messageInput.set('test message');

    await component.manualSuggest();

    expect(component.error()).toBe('Failed to suggest flashcards');
    expect(component.loading()).toBe(false);
    expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(1);
  });

  it('retries the current message after a failure', async () => {
    component.messageInput.set('retry message');
    mockSuggestService.suggestFromMessage.mockRejectedValueOnce(new Error('First fail'));
    await component.manualSuggest();

    mockSuggestService.suggestFromMessage.mockResolvedValueOnce({ suggestions: ['retry-word'] });
    component.handleRetry();
    await fixture.whenStable();

    expect(mockSuggestService.suggestFromMessage).toHaveBeenCalledTimes(2);
  });

  it('does not call the API for blank input', async () => {
    component.messageInput.set('   ');

    await component.manualSuggest();

    expect(mockSuggestService.suggestFromMessage).not.toHaveBeenCalled();
  });

  it('adds a suggestion to the vocabulary deck with bounded local context', async () => {
    component.messageInput.set('Hello world');
    component.suggestions.set(['hello', 'world']);

    await component.addWordToDeck('hello');

    expect(mockVocabStore.saveWord).toHaveBeenCalledWith({
      word_token: 'hello',
      translation: '',
      original_context: 'Hello world',
    });
    expect(component.addedWords().has('hello')).toBe(true);
  });

  it('does not add the same word twice', async () => {
    component.messageInput.set('test');
    component.suggestions.set(['hello']);
    component.addedWords.set(new Set(['hello']));

    await component.addWordToDeck('hello');

    expect(mockVocabStore.saveWord).not.toHaveBeenCalled();
  });

  it('reports failed deck writes without marking the word as added', async () => {
    mockVocabStore.saveWord.mockRejectedValueOnce(new Error('write failed'));
    component.messageInput.set('Hello world');

    await component.addWordToDeck('hello');

    expect(component.addedWords().has('hello')).toBe(false);
    expect(component.addingWords().has('hello')).toBe(false);
    expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(1);
  });
});
