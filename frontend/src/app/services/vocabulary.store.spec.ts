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
  let authSpy: { getAccessToken: ReturnType<typeof vi.fn> };

  const mockFlashcard: Flashcard = {
    id: '1',
    user_id: 'user1',
    word_token: 'hello',
    translation: 'hola',
    srs_level: 1,
    easiness_factor: 2.5,
    repetitions: 1,
    interval_days: 1,
    next_review_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    TestBed.resetTestingModule();

    authSpy = {
      getAccessToken: vi.fn().mockReturnValue('mock-token'),
    };

    TestBed.configureTestingModule({
      providers: [
        VocabularyStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authSpy },
      ],
    });

    store = TestBed.inject(VocabularyStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should be created', () => {
      expect(store).toBeTruthy();
    });

    it('should initialise flashcardMap as an empty Map', () => {
      expect(store.flashcardMap().size).toBe(0);
    });

    it('should initialise allFlashcards as an empty array', () => {
      expect(store.allFlashcards()).toEqual([]);
    });

    it('should initialise dueReviews as an empty array', () => {
      expect(store.dueReviews()).toEqual([]);
    });

    it('should initialise isLoading as false', () => {
      expect(store.isLoading()).toBe(false);
    });
  });

  describe('loadAllFlashcards', () => {
    it('should set isLoading to true while loading and false after', async () => {
      const promise = store.loadAllFlashcards();
      expect(store.isLoading()).toBe(true);

      httpMock.expectOne(`${environment.apiUrl}/flashcards`).flush([mockFlashcard]);
      await promise;

      expect(store.isLoading()).toBe(false);
    });

    it('should populate allFlashcards and flashcardMap signals', async () => {
      const promise = store.loadAllFlashcards();

      const req = httpMock.expectOne(`${environment.apiUrl}/flashcards`);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer mock-token');

      req.flush([mockFlashcard]);
      await promise;

      expect(store.allFlashcards().length).toBe(1);
      expect(store.allFlashcards()[0]).toEqual(mockFlashcard);
      expect(store.flashcardMap().get('hello')).toEqual(mockFlashcard);
    });

    it('should lower-case word tokens when building flashcardMap', async () => {
      const upperCard = { ...mockFlashcard, word_token: 'HELLO' };
      const promise = store.loadAllFlashcards();

      httpMock.expectOne(`${environment.apiUrl}/flashcards`).flush([upperCard]);
      await promise;

      expect(store.flashcardMap().get('hello')).toEqual(upperCard);
      expect(store.flashcardMap().get('HELLO')).toBeUndefined();
    });

    it('should handle error gracefully and set isLoading to false', async () => {
      const promise = store.loadAllFlashcards();

      httpMock.expectOne(`${environment.apiUrl}/flashcards`).flush(
        { message: 'Server error' },
        { status: 500, statusText: 'Internal Server Error' },
      );
      await promise;

      expect(store.isLoading()).toBe(false);
      expect(store.allFlashcards()).toEqual([]);
      expect(store.flashcardMap().size).toBe(0);
    });
  });

  describe('loadDueReviews', () => {
    it('should fetch due reviews and update the signal', async () => {
      const promise = store.loadDueReviews();

      const req = httpMock.expectOne(`${environment.apiUrl}/flashcards/due`);
      expect(req.request.method).toBe('GET');

      req.flush([mockFlashcard]);
      await promise;

      expect(store.dueReviews().length).toBe(1);
      expect(store.dueReviews()[0]).toEqual(mockFlashcard);
    });

    it('should handle error gracefully', async () => {
      const promise = store.loadDueReviews();

      httpMock.expectOne(`${environment.apiUrl}/flashcards/due`).flush(
        {},
        { status: 500, statusText: 'Server Error' },
      );
      await promise;

      expect(store.dueReviews()).toEqual([]);
    });
  });

  describe('getWordStatus', () => {
    it('should return level 0 with blue styling for unknown words', () => {
      const status = store.getWordStatus('unknown');
      expect(status.level).toBe(0);
      expect(status.flashcard).toBeUndefined();
      expect(status.colourClass).toContain('bg-blue-500/20');
    });

    it('should return level and amber styling for learning words (srs 1-3)', () => {
      store.flashcardMap.set(new Map([['hello', mockFlashcard]]));
      const status = store.getWordStatus('hello');
      expect(status.level).toBe(1);
      expect(status.flashcard).toEqual(mockFlashcard);
      expect(status.colourClass).toContain('bg-amber-500/20');
    });

    it('should return level and white styling for known words (srs 4+)', () => {
      const knownCard = { ...mockFlashcard, srs_level: 4 };
      store.flashcardMap.set(new Map([['hello', knownCard]]));
      const status = store.getWordStatus('hello');
      expect(status.level).toBe(4);
      expect(status.flashcard).toEqual(knownCard);
      expect(status.colourClass).toContain('text-text-primary');
    });

    it('should trim and lower-case the input word', () => {
      store.flashcardMap.set(new Map([['hello', mockFlashcard]]));
      const status = store.getWordStatus('  Hello  ');
      expect(status.level).toBe(1);
      expect(status.flashcard).toEqual(mockFlashcard);
    });

    it('should return colorClass equal to colourClass', () => {
      store.flashcardMap.set(new Map([['hello', mockFlashcard]]));
      const status = store.getWordStatus('hello');
      expect(status.colorClass).toBe(status.colourClass);
    });
  });

  describe('saveWord', () => {
    it('should POST and prepend the new flashcard to allFlashcards', async () => {
      store.allFlashcards.set([mockFlashcard]);
      store.flashcardMap.set(new Map([['hello', mockFlashcard]]));

      const payload = { word_token: 'world', translation: 'mundo' };
      const newCard = { ...mockFlashcard, id: '2', word_token: 'world', translation: 'mundo' };

      const promise = store.saveWord(payload);

      const req = httpMock.expectOne(`${environment.apiUrl}/flashcards`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);

      req.flush(newCard);
      const result = await promise;

      expect(result).toEqual(newCard);
      expect(store.allFlashcards().length).toBe(2);
      expect(store.allFlashcards()[0]).toEqual(newCard);
      expect(store.flashcardMap().get('world')).toEqual(newCard);
    });

    it('should replace an existing flashcard with the same word_token', async () => {
      store.allFlashcards.set([mockFlashcard]);
      store.flashcardMap.set(new Map([['hello', mockFlashcard]]));

      const updatedPayload = { word_token: 'hello', translation: 'hola-updated' };
      const updatedCard = { ...mockFlashcard, translation: 'hola-updated' };

      const promise = store.saveWord(updatedPayload);

      httpMock.expectOne(`${environment.apiUrl}/flashcards`).flush(updatedCard);
      await promise;

      expect(store.allFlashcards().length).toBe(1);
      expect(store.allFlashcards()[0].translation).toBe('hola-updated');
      expect(store.flashcardMap().get('hello')?.translation).toBe('hola-updated');
    });
  });

  describe('updateSrsLevel', () => {
    it('should PATCH and update the flashcard in all signals', async () => {
      store.allFlashcards.set([mockFlashcard]);
      store.flashcardMap.set(new Map([['hello', mockFlashcard]]));

      const updatedCard = { ...mockFlashcard, srs_level: 2, next_review_at: '2026-08-07T00:00:00Z' };
      const promise = store.updateSrsLevel('1', 4);

      const req = httpMock.expectOne(`${environment.apiUrl}/flashcards/1/srs`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ quality: 4 });

      req.flush(updatedCard);
      const result = await promise;

      expect(result).toEqual(updatedCard);
      expect(store.allFlashcards()[0].srs_level).toBe(2);
      expect(store.allFlashcards()[0].next_review_at).toBe('2026-08-07T00:00:00Z');
      expect(store.flashcardMap().get('hello')?.srs_level).toBe(2);
    });

    it('should update the correct flashcard when multiple exist', async () => {
      const card2 = { ...mockFlashcard, id: '2', word_token: 'world', translation: 'mundo' };
      store.allFlashcards.set([mockFlashcard, card2]);
      store.flashcardMap.set(new Map([['hello', mockFlashcard], ['world', card2]]));

      const updatedCard = { ...mockFlashcard, srs_level: 3 };
      const promise = store.updateSrsLevel('1', 3);

      httpMock.expectOne(`${environment.apiUrl}/flashcards/1/srs`).flush(updatedCard);
      await promise;

      expect(store.allFlashcards().length).toBe(2);
      expect(store.allFlashcards()[0].srs_level).toBe(3);
      expect(store.allFlashcards()[1].srs_level).toBe(1);
      expect(store.flashcardMap().get('hello')?.srs_level).toBe(3);
      expect(store.flashcardMap().get('world')?.srs_level).toBe(1);
    });
  });

  describe('translateWordOrSentence', () => {
    it('should POST to the NLP translate endpoint', async () => {
      const translationResult = {
        original_text: 'hello',
        translated_text: 'hola',
        detected_language: 'en',
      };
      const promise = store.translateWordOrSentence('hello', 'es');

      const req = httpMock.expectOne(`${environment.apiUrl}/nlp/translate`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        text: 'hello',
        target_language: 'es',
        source_language: undefined,
      });

      req.flush(translationResult);
      const result = await promise;

      expect(result).toEqual(translationResult);
    });

    it('should include optional source language', async () => {
      const promise = store.translateWordOrSentence('hello', 'es', 'en');

      const req = httpMock.expectOne(`${environment.apiUrl}/nlp/translate`);
      expect(req.request.body.source_language).toBe('en');

      req.flush({ original_text: 'hello', translated_text: 'hola', detected_language: 'en' });
      await promise;
    });
  });

  describe('checkGrammar', () => {
    it('should POST to the NLP grammar-check endpoint', async () => {
      const grammarResult = {
        original: 'hola',
        corrected: 'hola',
        explanation: 'No errors found',
        errors_found: 0,
      };
      const promise = store.checkGrammar('hola', 'es');

      const req = httpMock.expectOne(`${environment.apiUrl}/nlp/grammar-check`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ text: 'hola', language: 'es' });

      req.flush(grammarResult);
      const result = await promise;

      expect(result).toEqual(grammarResult);
    });
  });

  describe('scorePronunciation', () => {
    it('should POST to the NLP pronunciation-score endpoint', async () => {
      const scoreResult = {
        overall_score: 85,
        breakdown: [{ word: 'hello', score: 85 }],
        feedback_summary: 'Good job',
      };
      const promise = store.scorePronunciation('http://audio.url', 'hello', 'en');

      const req = httpMock.expectOne(`${environment.apiUrl}/nlp/pronunciation-score`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        audio_url: 'http://audio.url',
        target_text: 'hello',
        language: 'en',
      });

      req.flush(scoreResult);
      const result = await promise;

      expect(result).toEqual(scoreResult);
    });
  });

  describe('haptic feedback', () => {
    it('should vibrate with success buzz for known words (srs >= 4)', async () => {
      const vibrateSpy = vi.fn();
      vi.stubGlobal('navigator', { vibrate: vibrateSpy });

      store.allFlashcards.set([mockFlashcard]);
      store.flashcardMap.set(new Map([['hello', mockFlashcard]]));

      const updatedCard = { ...mockFlashcard, srs_level: 4 };
      const promise = store.updateSrsLevel('1', 4);
      httpMock.expectOne(`${environment.apiUrl}/flashcards/1/srs`).flush(updatedCard);
      await promise;

      expect(vibrateSpy).toHaveBeenCalledWith(100);
    });

    it('should vibrate with gentle pulse for learning words (srs 1-3)', async () => {
      const vibrateSpy = vi.fn();
      vi.stubGlobal('navigator', { vibrate: vibrateSpy });

      store.allFlashcards.set([mockFlashcard]);
      store.flashcardMap.set(new Map([['hello', mockFlashcard]]));

      const updatedCard = { ...mockFlashcard, srs_level: 2 };
      const promise = store.updateSrsLevel('1', 2);
      httpMock.expectOne(`${environment.apiUrl}/flashcards/1/srs`).flush(updatedCard);
      await promise;

      expect(vibrateSpy).toHaveBeenCalledWith([50, 50, 50]);
    });

    it('should not throw if navigator.vibrate is undefined', async () => {
      vi.stubGlobal('navigator', {});

      store.allFlashcards.set([mockFlashcard]);
      store.flashcardMap.set(new Map([['hello', mockFlashcard]]));

      const updatedCard = { ...mockFlashcard, srs_level: 2 };
      const promise = store.updateSrsLevel('1', 2);
      httpMock.expectOne(`${environment.apiUrl}/flashcards/1/srs`).flush(updatedCard);
      await expect(promise).resolves.toBeDefined();
    });
  });

  describe('getHeaders', () => {
    it('should use empty token when getAccessToken returns undefined', async () => {
      authSpy.getAccessToken.mockReturnValue(undefined);

      const promise = store.loadAllFlashcards();

      const req = httpMock.expectOne(`${environment.apiUrl}/flashcards`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer ');

      req.flush([]);
      await promise;
    });

    it('should use empty token when getAccessToken returns null', async () => {
      authSpy.getAccessToken.mockReturnValue(null);

      const promise = store.loadAllFlashcards();

      const req = httpMock.expectOne(`${environment.apiUrl}/flashcards`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer ');

      req.flush([]);
      await promise;
    });
  });
});
