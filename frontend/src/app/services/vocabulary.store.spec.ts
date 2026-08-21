import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { VocabularyStore, Flashcard } from './vocabulary.store';
import { AuthService } from './auth.service';
import { SrsOfflineService } from './srs-offline.service';
import { SrsCircuitBreakerService } from './srs-circuit-breaker.service';
import { environment } from '../../environments/environment';

describe('VocabularyStore', () => {
  let store: VocabularyStore;
  let httpMock: HttpTestingController;
  let authSpy: { getAccessToken: ReturnType<typeof vi.fn> };
  let srsOfflineSpy: {
    cacheFlashcards: ReturnType<typeof vi.fn>;
    getCachedFlashcards: ReturnType<typeof vi.fn>;
    cacheDueReviews: ReturnType<typeof vi.fn>;
    getCachedDueReviews: ReturnType<typeof vi.fn>;
    queueSrsReview: ReturnType<typeof vi.fn>;
    syncQueuedReviews: ReturnType<typeof vi.fn>;
    online: ReturnType<typeof vi.fn>;
  };

  let circuitBreakerSpy: {
    executeWithBreaker: ReturnType<typeof vi.fn>;
    isAvailable: ReturnType<typeof vi.fn>;
    recordSuccess: ReturnType<typeof vi.fn>;
    recordFailure: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  };

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

    srsOfflineSpy = {
      cacheFlashcards: vi.fn().mockResolvedValue(undefined),
      getCachedFlashcards: vi.fn().mockResolvedValue([]),
      cacheDueReviews: vi.fn().mockResolvedValue(undefined),
      getCachedDueReviews: vi.fn().mockResolvedValue([]),
      queueSrsReview: vi.fn().mockResolvedValue(undefined),
      syncQueuedReviews: vi.fn().mockResolvedValue({ synced: 0, failed: 0 }),
      online: vi.fn().mockReturnValue(true),
    };

    circuitBreakerSpy = {
      executeWithBreaker: vi
        .fn()
        .mockImplementation(
          (
            _service: string,
            operation: () => Promise<unknown>,
            _fallback: () => Promise<unknown>,
          ) => operation(),
        ),
      isAvailable: vi.fn().mockReturnValue(true),
      recordSuccess: vi.fn(),
      recordFailure: vi.fn(),
      reset: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        VocabularyStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authSpy },
        { provide: SrsOfflineService, useValue: srsOfflineSpy },
        { provide: SrsCircuitBreakerService, useValue: circuitBreakerSpy },
      ],
    });

    store = TestBed.inject(VocabularyStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

      httpMock
        .expectOne(`${environment.apiUrl}/flashcards`)
        .flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
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

      httpMock
        .expectOne(`${environment.apiUrl}/flashcards/due`)
        .flush({}, { status: 500, statusText: 'Server Error' });
      await promise;

      expect(store.dueReviews()).toEqual([]);
    });
  });

  describe('getWordStatus', () => {
    it('should return level 0 with secondary-accent styling for unknown words', () => {
      const status = store.getWordStatus('unknown');
      expect(status.level).toBe(0);
      expect(status.flashcard).toBeUndefined();
      expect(status.colourClass).toContain('bg-secondary/20');
    });

    it('should return level and warning styling for learning words (srs 1-3)', () => {
      store.flashcardMap.set(new Map([['hello', mockFlashcard]]));
      const status = store.getWordStatus('hello');
      expect(status.level).toBe(1);
      expect(status.flashcard).toEqual(mockFlashcard);
      expect(status.colourClass).toContain('bg-warning/20');
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

      const updatedCard = {
        ...mockFlashcard,
        srs_level: 2,
        next_review_at: '2026-08-07T00:00:00Z',
      };
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
      store.flashcardMap.set(
        new Map([
          ['hello', mockFlashcard],
          ['world', card2],
        ]),
      );

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

  describe('html sanitisation', () => {
    it('should sanitise HTML in flashcard text fields loaded from server', async () => {
      const maliciousCard = {
        ...mockFlashcard,
        word_token: '<b>hello</b>',
        translation: '<script>alert("xss")</script>hola',
        definition: '<img src=x onerror=alert(1)>greeting',
        original_context: '<div onclick="steal()">Context</div>',
      };
      const promise = store.loadAllFlashcards();
      httpMock.expectOne(`${environment.apiUrl}/flashcards`).flush([maliciousCard]);
      await promise;

      const stored = store.allFlashcards()[0];
      expect(stored.word_token).toBe('hello');
      expect(stored.translation).toBe('hola');
      expect(stored.definition).toBe('greeting');
      expect(stored.original_context).toBe('Context');
    });

    it('should sanitise HTML in due review cards', async () => {
      const maliciousCard = {
        ...mockFlashcard,
        translation: '<b>mundo</b>',
      };
      const promise = store.loadDueReviews();
      httpMock.expectOne(`${environment.apiUrl}/flashcards/due`).flush([maliciousCard]);
      await promise;

      expect(store.dueReviews()[0].translation).toBe('mundo');
    });

    it('should sanitise flashcard returned from saveWord', async () => {
      const payload = { word_token: 'test', translation: 'prueba' };
      const newCard = {
        ...mockFlashcard,
        id: 'new',
        word_token: '<i>test</i>',
        translation: '<div>prueba</div>',
      };
      const promise = store.saveWord(payload);
      httpMock.expectOne(`${environment.apiUrl}/flashcards`).flush(newCard);
      const result = await promise;

      expect(result.word_token).toBe('test');
      expect(result.translation).toBe('prueba');
    });

    it('should sanitise flashcard returned from updateSrsLevel', async () => {
      store.allFlashcards.set([mockFlashcard]);
      store.flashcardMap.set(new Map([['hello', mockFlashcard]]));

      const updatedCard = { ...mockFlashcard, srs_level: 2, translation: '<b>hola</b>' };
      const promise = store.updateSrsLevel('1', 4);
      httpMock.expectOne(`${environment.apiUrl}/flashcards/1/srs`).flush(updatedCard);
      const result = await promise;

      expect(result.translation).toBe('hola');
    });

    it('should sanitise malicious URLs in pronunciation_url', async () => {
      const maliciousCard = {
        ...mockFlashcard,
        pronunciation_url: 'javascript:alert(1)',
      };
      const promise = store.loadAllFlashcards();
      httpMock.expectOne(`${environment.apiUrl}/flashcards`).flush([maliciousCard]);
      await promise;

      expect(store.allFlashcards()[0].pronunciation_url).toBe('');
    });
  });

  describe('signal consistency', () => {
    it('should keep allFlashcards and flashcardMap in sync after loadAllFlashcards', async () => {
      const cards = [
        { ...mockFlashcard, id: '1', word_token: 'hello' },
        { ...mockFlashcard, id: '2', word_token: 'world', translation: 'mundo' },
      ];
      const promise = store.loadAllFlashcards();
      httpMock.expectOne(`${environment.apiUrl}/flashcards`).flush(cards);
      await promise;

      expect(store.allFlashcards().length).toBe(2);
      expect(store.flashcardMap().size).toBe(2);
      expect(store.flashcardMap().get('hello')).toEqual(cards[0]);
      expect(store.flashcardMap().get('world')).toEqual(cards[1]);
    });

    it('should keep allFlashcards and flashcardMap in sync after saveWord', async () => {
      const payload = { word_token: 'test', translation: 'prueba' };
      const newCard = { ...mockFlashcard, id: 'new', word_token: 'test', translation: 'prueba' };
      const promise = store.saveWord(payload);
      httpMock.expectOne(`${environment.apiUrl}/flashcards`).flush(newCard);
      await promise;

      expect(store.allFlashcards().length).toBe(1);
      expect(store.flashcardMap().size).toBe(1);
      expect(store.flashcardMap().get('test')).toEqual(newCard);
    });

    it('should keep allFlashcards and flashcardMap in sync after updateSrsLevel', async () => {
      store.allFlashcards.set([mockFlashcard]);
      store.flashcardMap.set(new Map([['hello', mockFlashcard]]));

      const updatedCard = { ...mockFlashcard, srs_level: 5 };
      const promise = store.updateSrsLevel('1', 5);
      httpMock.expectOne(`${environment.apiUrl}/flashcards/1/srs`).flush(updatedCard);
      await promise;

      expect(store.allFlashcards().length).toBe(1);
      expect(store.flashcardMap().size).toBe(1);
      expect(store.allFlashcards()[0]).toEqual(updatedCard);
      expect(store.flashcardMap().get('hello')).toEqual(updatedCard);
    });

    it('should reflect flashcardMap changes immediately via signal reactivity', () => {
      expect(store.flashcardMap().size).toBe(0);

      store.flashcardMap.update((map) => {
        const next = new Map(map);
        next.set('test', mockFlashcard);
        return next;
      });

      expect(store.flashcardMap().size).toBe(1);
      expect(store.flashcardMap().get('test')).toEqual(mockFlashcard);
    });
  });

  describe('loadDueReviews signal behaviour', () => {
    it('should not modify isLoading while fetching due reviews', async () => {
      expect(store.isLoading()).toBe(false);
      const promise = store.loadDueReviews();
      expect(store.isLoading()).toBe(false);

      httpMock.expectOne(`${environment.apiUrl}/flashcards/due`).flush([mockFlashcard]);
      await promise;

      expect(store.isLoading()).toBe(false);
    });

    it('should preserve previous dueReviews state on error', async () => {
      store.dueReviews.set([mockFlashcard]);
      const promise = store.loadDueReviews();
      httpMock
        .expectOne(`${environment.apiUrl}/flashcards/due`)
        .flush({ message: 'error' }, { status: 500, statusText: 'Error' });
      await promise;

      expect(store.dueReviews()).toEqual([mockFlashcard]);
    });

    it('should handle empty due reviews response', async () => {
      const promise = store.loadDueReviews();
      httpMock.expectOne(`${environment.apiUrl}/flashcards/due`).flush([]);
      await promise;

      expect(store.dueReviews()).toEqual([]);
    });
  });

  describe('error handling for write operations', () => {
    it('should handle saveWord failure gracefully', async () => {
      const promise = store.saveWord({ word_token: 'fail', translation: 'fallar' });
      httpMock
        .expectOne(`${environment.apiUrl}/flashcards`)
        .flush({ message: 'Conflict' }, { status: 409, statusText: 'Conflict' });

      await expect(promise).rejects.toThrow();
      expect(store.allFlashcards()).toEqual([]);
      expect(store.flashcardMap().size).toBe(0);
    });

    it('should handle updateSrsLevel offline fallback gracefully', async () => {
      store.allFlashcards.set([mockFlashcard]);
      store.flashcardMap.set(new Map([['hello', mockFlashcard]]));
      // jsdom returns undefined for navigator.onLine, which would trigger offline fallback.
      vi.stubGlobal('navigator', { onLine: true, vibrate: vi.fn() });
      srsOfflineSpy.online.mockReturnValue(false);

      // jsdom defaults navigator.onLine to false, so the offline path will activate
      const promise = store.updateSrsLevel('1', 2);
      httpMock
        .expectOne(`${environment.apiUrl}/flashcards/1/srs`)
        .flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });

      // With graceful degradation, the promise resolves with optimistically updated card
      const result = await promise;
      expect(result).toBeDefined();
      expect(result.srs_level).toBe(0); // quality 2 => estimateNewLevel returns 0
      expect(store.allFlashcards()[0].srs_level).toBe(0);
      expect(store.flashcardMap().get('hello')?.srs_level).toBe(0);
    });

    it('should gracefully degrade translateWordOrSentence on failure', async () => {
      const promise = store.translateWordOrSentence('hello', 'es');
      httpMock
        .expectOne(`${environment.apiUrl}/nlp/translate`)
        .flush(
          { message: 'Service unavailable' },
          { status: 503, statusText: 'Service Unavailable' },
        );

      const result = await promise;
      expect(result.original_text).toBe('hello');
      expect(result.translated_text).toBe('hello');
      expect(result.definition).toContain('unavailable');
    });

    it('should gracefully degrade checkGrammar on failure', async () => {
      const promise = store.checkGrammar('hola', 'es');
      httpMock
        .expectOne(`${environment.apiUrl}/nlp/grammar-check`)
        .flush({ message: 'Bad request' }, { status: 400, statusText: 'Bad Request' });

      const result = await promise;
      expect(result.original).toBe('hola');
      expect(result.corrected).toBe('hola');
      expect(result.errors_found).toBe(0);
    });

    it('should gracefully degrade scorePronunciation on failure', async () => {
      const promise = store.scorePronunciation('http://audio.url', 'hello', 'en');
      httpMock
        .expectOne(`${environment.apiUrl}/nlp/pronunciation-score`)
        .flush({ message: 'Internal error' }, { status: 500, statusText: 'Internal Server Error' });

      const result = await promise;
      expect(result.overall_score).toBe(85);
      expect(result.breakdown.length).toBeGreaterThan(0);
      expect(result.feedback_summary).toContain('unavailable');
    });
  });

  describe('isLoading signal state transitions', () => {
    it('should set isLoading true while loadAllFlashcards is in-flight', async () => {
      expect(store.isLoading()).toBe(false);
      const promise = store.loadAllFlashcards();

      expect(store.isLoading()).toBe(true);

      httpMock.expectOne(`${environment.apiUrl}/flashcards`).flush([]);
      await promise;

      expect(store.isLoading()).toBe(false);
    });

    it('should set isLoading false even on network error', async () => {
      const promise = store.loadAllFlashcards();
      httpMock
        .expectOne(`${environment.apiUrl}/flashcards`)
        .flush(null, { status: 0, statusText: 'Unknown Error' });
      await promise;

      expect(store.isLoading()).toBe(false);
    });

    it('should not change isLoading during saveWord', async () => {
      expect(store.isLoading()).toBe(false);
      const promise = store.saveWord({ word_token: 'test', translation: 'prueba' });
      expect(store.isLoading()).toBe(false);

      httpMock
        .expectOne(`${environment.apiUrl}/flashcards`)
        .flush({ ...mockFlashcard, id: 'saved', word_token: 'test' });
      await promise;

      expect(store.isLoading()).toBe(false);
    });
  });

  describe('loadAllFlashcards signal edge cases', () => {
    it('should handle empty array response', async () => {
      const promise = store.loadAllFlashcards();
      httpMock.expectOne(`${environment.apiUrl}/flashcards`).flush([]);
      await promise;

      expect(store.allFlashcards()).toEqual([]);
      expect(store.flashcardMap().size).toBe(0);
    });

    it('should replace previous state on subsequent loads', async () => {
      store.allFlashcards.set([mockFlashcard]);
      store.flashcardMap.set(new Map([['hello', mockFlashcard]]));

      const newCards = [{ ...mockFlashcard, id: '2', word_token: 'world', translation: 'mundo' }];
      const promise = store.loadAllFlashcards();
      httpMock.expectOne(`${environment.apiUrl}/flashcards`).flush(newCards);
      await promise;

      expect(store.allFlashcards().length).toBe(1);
      expect(store.allFlashcards()[0].word_token).toBe('world');
      expect(store.flashcardMap().size).toBe(1);
      expect(store.flashcardMap().get('hello')).toBeUndefined();
      expect(store.flashcardMap().get('world')).toEqual(newCards[0]);
    });
  });

  describe('getWordStatus boundary SRS levels', () => {
    it('should return secondary-accent styling for level 0 (new)', () => {
      const status = store.getWordStatus('newword');
      expect(status.level).toBe(0);
      expect(status.colourClass).toContain('bg-secondary/20');
      expect(status.flashcard).toBeUndefined();
    });

    it('should return warning styling for level 1', () => {
      const card = { ...mockFlashcard, srs_level: 1 };
      store.flashcardMap.set(new Map([['test', card]]));
      const status = store.getWordStatus('test');
      expect(status.level).toBe(1);
      expect(status.colourClass).toContain('bg-warning/20');
    });

    it('should return warning styling for level 3', () => {
      const card = { ...mockFlashcard, srs_level: 3 };
      store.flashcardMap.set(new Map([['test', card]]));
      const status = store.getWordStatus('test');
      expect(status.level).toBe(3);
      expect(status.colourClass).toContain('bg-warning/20');
    });

    it('should return white styling for level 4', () => {
      const card = { ...mockFlashcard, srs_level: 4 };
      store.flashcardMap.set(new Map([['test', card]]));
      const status = store.getWordStatus('test');
      expect(status.level).toBe(4);
      expect(status.colourClass).toContain('text-text-primary');
    });

    it('should return white styling for level 5+', () => {
      const card = { ...mockFlashcard, srs_level: 7 };
      store.flashcardMap.set(new Map([['test', card]]));
      const status = store.getWordStatus('test');
      expect(status.level).toBe(7);
      expect(status.colourClass).toContain('text-text-primary');
    });
  });

  describe('saveWord signal integrity', () => {
    it('should not affect existing unrelated flashcards when saving a new word', async () => {
      const existingCard = {
        ...mockFlashcard,
        id: 'existing',
        word_token: 'existing',
        translation: 'existente',
      };
      store.allFlashcards.set([existingCard]);
      store.flashcardMap.set(new Map([['existing', existingCard]]));

      const promise = store.saveWord({ word_token: 'new', translation: 'nuevo' });
      httpMock
        .expectOne(`${environment.apiUrl}/flashcards`)
        .flush({ ...mockFlashcard, id: 'new', word_token: 'new', translation: 'nuevo' });
      await promise;

      expect(store.allFlashcards().length).toBe(2);
      expect(store.flashcardMap().size).toBe(2);
      expect(store.flashcardMap().get('existing')).toEqual(existingCard);
    });

    it('should handle saveWord when allFlashcards is empty', async () => {
      const promise = store.saveWord({ word_token: 'first', translation: 'primero' });
      httpMock
        .expectOne(`${environment.apiUrl}/flashcards`)
        .flush({ ...mockFlashcard, id: 'first', word_token: 'first', translation: 'primero' });
      const result = await promise;

      expect(store.allFlashcards().length).toBe(1);
      expect(store.allFlashcards()[0]).toEqual(result);
      expect(store.flashcardMap().get('first')).toEqual(result);
    });
  });

  describe('updateSrsLevel signal integrity', () => {
    it('should not mutate other flashcards when updating SRS', async () => {
      const cardB = { ...mockFlashcard, id: 'b', word_token: 'b', translation: 'b' };
      store.allFlashcards.set([mockFlashcard, cardB]);
      store.flashcardMap.set(
        new Map([
          ['hello', mockFlashcard],
          ['b', cardB],
        ]),
      );

      const updatedA = { ...mockFlashcard, srs_level: 4 };
      const promise = store.updateSrsLevel('1', 4);
      httpMock.expectOne(`${environment.apiUrl}/flashcards/1/srs`).flush(updatedA);
      await promise;

      expect(store.flashcardMap().get('b')).toEqual(cardB);
      expect(store.allFlashcards().find((f) => f.id === 'b')).toEqual(cardB);
    });
  });

  describe('concurrent signal updates', () => {
    it('should handle rapid successive saveWord calls maintaining integrity', async () => {
      const card1 = { ...mockFlashcard, id: 'a', word_token: 'a', translation: 'A' };
      const card2 = { ...mockFlashcard, id: 'b', word_token: 'b', translation: 'B' };

      const promise1 = store.saveWord({ word_token: 'a', translation: 'A' });
      const req1 = httpMock.expectOne(`${environment.apiUrl}/flashcards`);
      req1.flush(card1);
      await promise1;

      const promise2 = store.saveWord({ word_token: 'b', translation: 'B' });
      const req2 = httpMock.expectOne(`${environment.apiUrl}/flashcards`);
      req2.flush(card2);
      await promise2;

      expect(store.allFlashcards().length).toBe(2);
      expect(store.flashcardMap().size).toBe(2);
      expect(store.flashcardMap().get('a')).toEqual(card1);
      expect(store.flashcardMap().get('b')).toEqual(card2);
    });
  });

  describe('NLP endpoints comprehensive coverage', () => {
    it('should send authorisation header with translateWordOrSentence', async () => {
      const promise = store.translateWordOrSentence('test', 'fr');
      const req = httpMock.expectOne(`${environment.apiUrl}/nlp/translate`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer mock-token');
      req.flush({ original_text: 'test', translated_text: 'test', detected_language: 'en' });
      await promise;
    });

    it('should send authorisation header with checkGrammar', async () => {
      const promise = store.checkGrammar('test');
      const req = httpMock.expectOne(`${environment.apiUrl}/nlp/grammar-check`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer mock-token');
      req.flush({ original: 'test', corrected: 'test', explanation: 'ok', errors_found: 0 });
      await promise;
    });

    it('should send authorisation header with scorePronunciation', async () => {
      const promise = store.scorePronunciation('url', 'text');
      const req = httpMock.expectOne(`${environment.apiUrl}/nlp/pronunciation-score`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer mock-token');
      req.flush({ overall_score: 90, breakdown: [], feedback_summary: 'good' });
      await promise;
    });

    it('should pass optional language undefined in checkGrammar by default', async () => {
      const promise = store.checkGrammar('text');
      const req = httpMock.expectOne(`${environment.apiUrl}/nlp/grammar-check`);
      expect(req.request.body.language).toBeUndefined();
      req.flush({ original: 'text', corrected: 'text', explanation: '', errors_found: 0 });
      await promise;
    });

    it('should pass optional language undefined in scorePronunciation by default', async () => {
      const promise = store.scorePronunciation('url', 'text');
      const req = httpMock.expectOne(`${environment.apiUrl}/nlp/pronunciation-score`);
      expect(req.request.body.language).toBeUndefined();
      req.flush({ overall_score: 100, breakdown: [], feedback_summary: '' });
      await promise;
    });
  });

  describe('isDegraded signal', () => {
    it('should initialise isDegraded as false', () => {
      expect(store.isDegraded()).toBe(false);
    });

    it('should set isDegraded to true when NLP translate fails', async () => {
      const promise = store.translateWordOrSentence('hello', 'es');
      httpMock
        .expectOne(`${environment.apiUrl}/nlp/translate`)
        .flush({}, { status: 503, statusText: 'Service Unavailable' });
      await promise;

      expect(store.isDegraded()).toBe(true);
    });

    it('should set isDegraded to true when grammar check fails', async () => {
      const promise = store.checkGrammar('hola');
      httpMock
        .expectOne(`${environment.apiUrl}/nlp/grammar-check`)
        .flush({}, { status: 500, statusText: 'Error' });
      await promise;

      expect(store.isDegraded()).toBe(true);
    });

    it('should set isDegraded to true when pronunciation scoring fails', async () => {
      const promise = store.scorePronunciation('url', 'text');
      httpMock
        .expectOne(`${environment.apiUrl}/nlp/pronunciation-score`)
        .flush({}, { status: 500, statusText: 'Error' });
      await promise;

      expect(store.isDegraded()).toBe(true);
    });

    it('should remain false when NLP calls succeed', async () => {
      const promise = store.translateWordOrSentence('hello', 'es');
      httpMock.expectOne(`${environment.apiUrl}/nlp/translate`).flush({
        original_text: 'hello',
        translated_text: 'hola',
        detected_language: 'en',
      });
      await promise;

      expect(store.isDegraded()).toBe(false);
    });
  });

  describe('degradedReason signal', () => {
    it('should initialise degradedReason as empty string', () => {
      expect(store.degradedReason()).toBe('');
    });
  });

  describe('pendingReviewCards signal', () => {
    it('should initialise as an empty array', () => {
      expect(store.pendingReviewCards()).toEqual([]);
    });

    it('should allow setting and reading pendingReviewCards', () => {
      const cards = [mockFlashcard];
      store.pendingReviewCards.set(cards);
      expect(store.pendingReviewCards()).toEqual(cards);
      expect(store.pendingReviewCards().length).toBe(1);
    });
  });

  describe('isOffline computed signal', () => {
    it('should be false when navigator.onLine is true', () => {
      vi.stubGlobal('navigator', { onLine: true, vibrate: vi.fn() });
      expect(store.isOffline()).toBe(false);
    });

    it('should be true when navigator.onLine is false', () => {
      vi.stubGlobal('navigator', { onLine: false, vibrate: vi.fn() });
      srsOfflineSpy.online.mockReturnValue(false);
      expect(store.isOffline()).toBe(true);
    });
  });

  describe('syncOfflineReviews', () => {
    it('should delegate to srsOffline.syncQueuedReviews and return result', async () => {
      srsOfflineSpy.syncQueuedReviews.mockResolvedValue({ synced: 3, failed: 1 });

      const result = await store.syncOfflineReviews();
      expect(result).toEqual({ synced: 3, failed: 1 });
      expect(srsOfflineSpy.syncQueuedReviews).toHaveBeenCalledOnce();
    });
  });
});
