import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { VocabularyDisplayComponent } from './vocabulary-display.component';
import { HobbyTagsStore } from '../../services/hobby-tags.store';
import { FlashcardService } from '../../services/flashcard.service';
import { signal } from '@angular/core';

describe('VocabularyDisplayComponent', () => {
  beforeEach(async () => {
    TestBed.resetTestingModule(); // prevent multiple instantiation errors
    const mockStore = {
      loading: signal(false),
      vocabularyByTag: signal(new Map([['tag1', [{ word: 'test', translation: 'prueba', hobbyTagName: 'tag1' }]]])),
      allTags: signal([]),
      loadVocabulary: vi.fn()
    };
    const mockFlashcardService = {
      createFlashcard: vi.fn().mockResolvedValue({})
    };

    await TestBed.configureTestingModule({
      imports: [VocabularyDisplayComponent],
      providers: [
        { provide: HobbyTagsStore, useValue: mockStore },
        { provide: FlashcardService, useValue: mockFlashcardService }
      ]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(VocabularyDisplayComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
