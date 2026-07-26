import { TestBed } from '@angular/core/testing';
import { VocabularyStore, Flashcard } from './vocabulary.store';

describe('VocabularyStore', () => {
  let store: VocabularyStore;

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
    expect(store.flashcards()).toEqual([]);
  });

  it('should add a flashcard and update the signal', () => {
    store.addFlashcard(mockFlashcard);
    
    const flashcards = store.flashcards();
    expect(flashcards.length).toBe(1);
    expect(flashcards[0].word_token).toBe('gato');
  });

  it('should compute vocabularyMap correctly for the TokenisedTextComponent', () => {
    store.addFlashcard(mockFlashcard);
    
    const map = store.vocabularyMap();
    expect(map instanceof Map).toBe(true);
    expect(map.has('gato')).toBe(true);
    expect(map.get('gato')).toBe(0); // Blue/New level
  });

  it('should update the SRS level of an existing flashcard', () => {
    store.addFlashcard(mockFlashcard);
    
    // Update SRS level to 4 (White/Known)
    store.updateSrsLevel('fc-123', 4);
    
    const updatedCard = store.flashcards().find(f => f.id === 'fc-123');
    expect(updatedCard?.srs_level).toBe(4);
    
    const map = store.vocabularyMap();
    expect(map.get('gato')).toBe(4);
  });

  it('should remove a flashcard', () => {
    store.addFlashcard(mockFlashcard);
    expect(store.flashcards().length).toBe(1);

    store.removeFlashcard('fc-123');
    expect(store.flashcards().length).toBe(0);
    
    const map = store.vocabularyMap();
    expect(map.has('gato')).toBe(false);
  });
});
