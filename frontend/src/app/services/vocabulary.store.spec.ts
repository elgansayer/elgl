import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { VocabularyStore, Flashcard } from './vocabulary.store';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

describe('VocabularyStore', () => {
  let store: VocabularyStore;
  let httpMock: HttpTestingController;
  let authServiceSpy: any;

  const mockFlashcard: Flashcard = {
    id: '1',
    user_id: 'user1',
    word_token: 'hello',
    translation: 'hola',
    srs_level: 1,
    next_review_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  beforeEach(() => {
    const spy = {
      getAccessToken: vi.fn().mockReturnValue('mock-token')
    };

    TestBed.configureTestingModule({
      providers: [
        VocabularyStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: spy }
      ]
    });

    store = TestBed.inject(VocabularyStore);
    httpMock = TestBed.inject(HttpTestingController);
    authServiceSpy = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  it('should load all flashcards and update signals', async () => {
    const promise = store.loadAllFlashcards();
    
    expect(store.isLoading()).toBe(true);

    const req = httpMock.expectOne(`${environment.apiUrl}/flashcards`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer mock-token');
    
    req.flush([mockFlashcard]);
    await promise;

    expect(store.isLoading()).toBe(false);
    expect(store.allFlashcards().length).toBe(1);
    expect(store.allFlashcards()[0]).toEqual(mockFlashcard);
    expect(store.flashcardMap().get('hello')).toEqual(mockFlashcard);
  });

  it('should load due reviews and update signals', async () => {
    const promise = store.loadDueReviews();

    const req = httpMock.expectOne(`${environment.apiUrl}/flashcards/due`);
    expect(req.request.method).toBe('GET');
    
    req.flush([mockFlashcard]);
    await promise;

    expect(store.dueReviews().length).toBe(1);
    expect(store.dueReviews()[0]).toEqual(mockFlashcard);
  });

  it('should get word status correctly for new word (level 0)', () => {
    const status = store.getWordStatus('unknown');
    expect(status.level).toBe(0);
    expect(status.flashcard).toBeUndefined();
  });

  it('should get word status correctly for learning word (level 1-3)', () => {
    store.flashcardMap.set(new Map([['hello', mockFlashcard]]));
    const status = store.getWordStatus('hello');
    expect(status.level).toBe(1);
    expect(status.flashcard).toEqual(mockFlashcard);
  });

  it('should get word status correctly for known word (level 4+)', () => {
    const knownCard = { ...mockFlashcard, srs_level: 4 };
    store.flashcardMap.set(new Map([['hello', knownCard]]));
    const status = store.getWordStatus('hello');
    expect(status.level).toBe(4);
    expect(status.flashcard).toEqual(knownCard);
  });

  it('should save word and update signals', async () => {
    const payload = { word_token: 'world', translation: 'mundo' };
    const newCard = { ...mockFlashcard, id: '2', word_token: 'world', translation: 'mundo' };

    const promise = store.saveWord(payload);

    const req = httpMock.expectOne(`${environment.apiUrl}/flashcards`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    
    req.flush(newCard);
    await promise;

    expect(store.allFlashcards().length).toBe(1);
    expect(store.allFlashcards()[0]).toEqual(newCard);
    expect(store.flashcardMap().get('world')).toEqual(newCard);
  });

  it('should update SRS level and update signals', async () => {
    store.allFlashcards.set([mockFlashcard]);
    store.flashcardMap.set(new Map([['hello', mockFlashcard]]));

    const updatedCard = { ...mockFlashcard, srs_level: 2 };
    const promise = store.updateSrsLevel('1', 2);

    const req = httpMock.expectOne(`${environment.apiUrl}/flashcards/1/srs`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ srs_level: 2 });
    
    req.flush(updatedCard);
    await promise;

    expect(store.allFlashcards()[0].srs_level).toBe(2);
    expect(store.flashcardMap().get('hello')?.srs_level).toBe(2);
  });
});
