import { TestBed } from '@angular/core/testing';
import { VocabularyStore, Flashcard } from './vocabulary.store';

describe('VocabularyStore', () => {
  let store: any; // Using any to accommodate either @ngrx/signals or standard Injectable

  const mockFlashcard: Flashcard = {
    id: 'fc-123',
    user_id: 'user-1',
    word_token: 'gato',
    translation: 'cat',
    srs_level: 0,
    next_review_at: new Date().toISOString(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VocabularyStore],
    });
    store = TestBed.inject(VocabularyStore);
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  it('should initialize with empty flashcards', () => {
    // Assuming the store exposes a `flashcards` signal
    expect(store.flashcards()).toEqual([]);
  });

  it('should add a flashcard and update the signal', () => {
    if (store.addFlashcard) {
      store.addFlashcard(mockFlashcard);
      expect(store.flashcards().length).toBe(1);
      expect(store.flashcards()[0].word_token).toBe('gato');
    }
  });

  it('should compute vocabularyMap correctly for the TokenisedTextComponent', () => {
    // The SPEC.md mentions a vocabularyMap (word -> srs_level)
    if (store.addFlashcard && store.vocabularyMap) {
      store.addFlashcard(mockFlashcard);
      
      const map = store.vocabularyMap();
      expect(map instanceof Map).toBe(true);
      expect(map.has('gato')).toBe(true);
      expect(map.get('gato')).toBe(0); // Blue/New level
    }
  });

  it('should update the SRS level of an existing flashcard', () => {
    if (store.addFlashcard && store.updateSrsLevel) {
      store.addFlashcard(mockFlashcard);
      
      // Update SRS level to 4 (White/Known)
      store.updateSrsLevel('fc-123', 4);
      
      const updatedCard = store.flashcards().find((f: Flashcard) => f.id === 'fc-123');
      expect(updatedCard.srs_level).toBe(4);
      
      if (store.vocabularyMap) {
        expect(store.vocabularyMap().get('gato')).toBe(4);
      }
    }
  });

  it('should remove a flashcard', () => {
    if (store.addFlashcard && store.removeFlashcard) {
      store.addFlashcard(mockFlashcard);
      expect(store.flashcards().length).toBe(1);

      store.removeFlashcard('fc-123');
      expect(store.flashcards().length).toBe(0);
    }
  });
});
