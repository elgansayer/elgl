import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { computed, signal, WritableSignal, ErrorHandler } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { VocabularyStore, Flashcard } from './vocabulary.store';
import { AuthService } from './auth.service';
import { SrsOfflineService } from './srs-offline.service';
import { HtmlSanitisationService } from './html-sanitisation.service';
import { environment } from '../../environments/environment';

describe('VocabularyStore', () => {
  let store: VocabularyStore;
  let httpMock: HttpTestingController;
  let authSpy: { getAccessToken: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };
  let srsOfflineSpy: {
    cacheFlashcards: ReturnType<typeof vi.fn>;
    getCachedFlashcards: ReturnType<typeof vi.fn>;
    cacheDueReviews: ReturnType<typeof vi.fn>;
    getCachedDueReviews: ReturnType<typeof vi.fn>;
    queueSrsReview: ReturnType<typeof vi.fn>;
    syncQueuedReviews: ReturnType<typeof vi.fn>;
    online: WritableSignal<boolean>;
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

    errorHandlerSpy = {
      handleError: vi.fn(),
    };

    srsOfflineSpy = {
      cacheFlashcards: vi.fn().mockResolvedValue(undefined),
      getCachedFlashcards: vi.fn().mockResolvedValue([]),
      cacheDueReviews: vi.fn().mockResolvedValue(undefined),
      getCachedDueReviews: vi.fn().mockResolvedValue([]),
      queueSrsReview: vi.fn().mockResolvedValue(undefined),
      syncQueuedReviews: vi.fn().mockResolvedValue({ synced: 0, failed: 0 }),
      online: signal(true),
    };

    TestBed.configureTestingModule({
      providers: [
        VocabularyStore,
        HtmlSanitisationService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authSpy },
        { provide: ErrorHandler, useValue: errorHandlerSpy },
        { provide: SrsOfflineService, useValue: srsOfflineSpy },
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

  describe('initial signal state', () => {
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

    it('should initialise isDegraded as false', () => {
      expect(store.isDegraded()).toBe(false);
    });

    it('should initialise degradedReason as empty string', () => {
      expect(store.degradedReason()).toBe('');
    });

    it('should initialise pendingReviewCards as an empty array', () => {
      expect(store.pendingReviewCards()).toEqual([]);
    });

    it('should compute isOffline as false when srsOffline.online is true', () => {
      expect(store.isOffline()).toBe(false);
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
      expect(srsOfflineSpy.cacheFlashcards).toHaveBeenCalledWith([mockFlashcard]);
    });

    it('should lower-case word tokens when building flashcardMap', async () => {
      const upperCard = { ...mockFlashcard, word_token: 'HELLO' };
      const promise = store.loadAllFlashcards();

      httpMock.expectOne(`${environment.apiUrl}/flashcards`).flush([upperCard]);
      await promise;

      expect(store.flashcardMap().get('hello')).toEqual(upperCard);
      expect(store.flashcardMap().get('HELLO')).toBeUndefined();
    });

    it('should handle error gracefully, report to ErrorHandler, and set isLoading to false', async () => {
      const promise = store.loadAllFlashcards();

      httpMock
        .expectOne(`${environment.apiUrl}/flashcards`)
        .flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
      await promise;

      expect(store.isLoading()).toBe(false);
      expect(store.allFlashcards()).toEqual([]);
      expect(store.flashcardMap().size).toBe(0);
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('should fallback to cached flashcards when offline', async () => {
      srsOfflineSpy.online.set(false);
      const cachedCard = { ...mockFlashcard, id: 'cached-1', word_token: 'offline' };
      srsOfflineSpy.getCachedFlashcards.mockResolvedValue([cachedCard]);

      const promise = store.loadAllFlashcards();

      httpMock
        .expectOne(`${environment.apiUrl}/flashcards`)
        .flush(null, { status: 0, statusText: 'Network Error' });
      await promise;

      expect(store.isLoading()).toBe(false);
      expect(store.allFlashcards()).toEqual([cachedCard]);
      expect(store.flashcardMap().get('offline')).toEqual(cachedCard);
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
      expect(srsOfflineSpy.cacheDueReviews).toHaveBeenCalledWith([mockFlashcard]);
    });

    it('should handle error gracefully and report error', async () => {
      const promise = store.loadDueReviews();

      httpMock
        .expectOne(`${environment.apiUrl}/flashcards/due`)
        .flush({}, { status: 500, statusText: 'Server Error' });
      await promise;

      expect(store.dueReviews()).toEqual([]);
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('should fallback to cached due reviews when offline', async () => {
      srsOfflineSpy.online.set(false);
      const cachedDue = [{ ...mockFlashcard, id: 'due-1', word_token: 'reviewme' }];
      srsOfflineSpy.getCachedDueReviews.mockResolvedValue(cachedDue);

      const promise = store.loadDueReviews();

      httpMock
        .expectOne(`${environment.apiUrl}/flashcards/due`)
        .flush(null, { status: 0, statusText: 'Network Error' });
      await promise;

      expect(store.dueReviews()).toEqual(cachedDue);
    });
  });

  describe('getWordStatus', () => {
    it('should return level 0 with secondary-accent styling for unknown words', () => {
      const status = store.getWordStatus('unknown');
      expect(status.level).toBe(0);
      expect(status.flashcard).toBeUndefined();
      expect(status.colourClass).toContain('bg-secondary/20');
      expect(status.colorClass).toBe(status.colourClass);
    });

    it('should return level and warning styling for learning words (srs 1-3)', () => {
      store.flashcardMap.set(new Map([['hello', mockFlashcard]]));
      const status = store.getWordStatus('hello');
      expect(status.level).toBe(1);
      expect(status.flashcard).toEqual(mockFlashcard);
      expect(status.colourClass).toContain('bg-warning/20');
      expect(status.colorClass).toBe(status.colourClass);
    });

    it('should return level and primary text styling for known words (srs 4+)', () => {
      const knownCard = { ...mockFlashcard, srs_level: 4 };
      store.flashcardMap.set(new Map([['hello', knownCard]]));
      const status = store.getWordStatus('hello');
      expect(status.level).toBe(4);
      expect(status.flashcard).toEqual(knownCard);
      expect(status.colourClass).toContain('text-text-primary');
      expect(status.colorClass).toBe(status.colourClass);
    });

    it('should trim and lower-case the input word', () => {
      store.flashcardMap.set(new Map([['hello', mockFlashcard]]));
      const status = store.getWordStatus('  Hello  ');
      expect(status.level).toBe(1);
      expect(status.flashcard).toEqual(mockFlashcard);
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

    it('should handle offline fallback and optimistically update signals', async () => {
      store.allFlashcards.set([mockFlashcard]);
      store.flashcardMap.set(new Map([['hello', mockFlashcard]]));
      srsOfflineSpy.online.set(false);

      const promise = store.updateSrsLevel('1', 4);
      httpMock
        .expectOne(`${environment.apiUrl}/flashcards/1/srs`)
        .flush({ message: 'Network offline' }, { status: 0, statusText: 'Offline' });

      const result = await promise;
      expect(result).toBeDefined();
      expect(result.srs_level).toBe(2); // current=1, quality=4 -> estimateNewLevel returns 2
      expect(store.allFlashcards()[0].srs_level).toBe(2);
      expect(store.flashcardMap().get('hello')?.srs_level).toBe(2);
      expect(srsOfflineSpy.queueSrsReview).toHaveBeenCalledWith('1', 4, 2);
    });

    it('should throw error when online and update fails', async () => {
      store.allFlashcards.set([mockFlashcard]);
      store.flashcardMap.set(new Map([['hello', mockFlashcard]]));
      srsOfflineSpy.online.set(true);

      const promise = store.updateSrsLevel('1', 4);
      httpMock
        .expectOne(`${environment.apiUrl}/flashcards/1/srs`)
        .flush({ message: 'Server error' }, { status: 500, statusText: 'Server Error' });

      await expect(promise).rejects.toThrow('Failed to update SRS level');
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

    it('should set isDegraded signal on error and return fallback result', async () => {
      const promise = store.translateWordOrSentence('hello', 'es');
      httpMock
        .expectOne(`${environment.apiUrl}/nlp/translate`)
        .flush({}, { status: 503, statusText: 'Service Unavailable' });

      const result = await promise;
      expect(store.isDegraded()).toBe(true);
      expect(result.original_text).toBe('hello');
      expect(result.translated_text).toBe('hello');
      expect(result.definition).toContain('unavailable');
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

    it('should set isDegraded signal on error and return fallback result', async () => {
      const promise = store.checkGrammar('hola');
      httpMock
        .expectOne(`${environment.apiUrl}/nlp/grammar-check`)
        .flush({}, { status: 500, statusText: 'Error' });

      const result = await promise;
      expect(store.isDegraded()).toBe(true);
      expect(result.original).toBe('hola');
      expect(result.corrected).toBe('hola');
      expect(result.errors_found).toBe(0);
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

    it('should set isDegraded signal on error and return fallback result', async () => {
      const promise = store.scorePronunciation('http://audio.url', 'hello', 'en');
      httpMock
        .expectOne(`${environment.apiUrl}/nlp/pronunciation-score`)
        .flush({}, { status: 500, statusText: 'Error' });

      const result = await promise;
      expect(store.isDegraded()).toBe(true);
      expect(result.overall_score).toBe(85);
      expect(result.feedback_summary).toContain('unavailable');
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

  describe('signal reactivity and computed properties', () => {
    it('recomputes consumers when allFlashcards changes', () => {
      const learningCount = computed(
        () => store.allFlashcards().filter((card) => card.srs_level > 0 && card.srs_level < 4).length,
      );

      expect(learningCount()).toBe(0);

      store.allFlashcards.set([mockFlashcard, { ...mockFlashcard, id: 'card-2', word_token: 'known', srs_level: 4 }]);
      expect(learningCount()).toBe(1);

      store.allFlashcards.update((cards) => [
        ...cards,
        { ...mockFlashcard, id: 'card-3', word_token: 'learning', srs_level: 2 },
      ]);
      expect(learningCount()).toBe(2);
    });

    it('recomputes getWordStatus consumers when flashcardMap is replaced', () => {
      const helloLevel = computed(() => store.getWordStatus(' Hello ').level);

      expect(helloLevel()).toBe(0);

      store.flashcardMap.update((current) => {
        const next = new Map(current);
        next.set('hello', { ...mockFlashcard, srs_level: 2 });
        return next;
      });
      expect(helloLevel()).toBe(2);

      store.flashcardMap.update((current) => {
        const next = new Map(current);
        next.set('hello', { ...mockFlashcard, srs_level: 4 });
        return next;
      });
      expect(helloLevel()).toBe(4);
    });

    it('tracks the reactive offline computed signal from SrsOfflineService', () => {
      expect(store.isOffline()).toBe(false);

      srsOfflineSpy.online.set(false);
      expect(store.isOffline()).toBe(true);

      srsOfflineSpy.online.set(true);
      expect(store.isOffline()).toBe(false);
    });

    it('allows reading and writing pendingReviewCards independently', () => {
      const reviewCard = { ...mockFlashcard, id: 'review-card', word_token: 'review' };
      expect(store.pendingReviewCards()).toEqual([]);

      store.pendingReviewCards.set([reviewCard]);
      expect(store.pendingReviewCards()).toEqual([reviewCard]);
      expect(store.pendingReviewCards().length).toBe(1);

      store.pendingReviewCards.set([]);
      expect(store.pendingReviewCards()).toEqual([]);
    });

    it('keeps loading and degraded-state signals independently writable', () => {
      expect(store.isLoading()).toBe(false);
      expect(store.isDegraded()).toBe(false);
      expect(store.degradedReason()).toBe('');

      store.isLoading.set(true);
      store.isDegraded.set(true);
      store.degradedReason.set('nlp-service-down');

      expect(store.isLoading()).toBe(true);
      expect(store.isDegraded()).toBe(true);
      expect(store.degradedReason()).toBe('nlp-service-down');
    });
  });

  describe('syncOfflineReviews', () => {
    it('should delegate to srsOffline.syncQueuedReviews and call server PATCH in callback', async () => {
      srsOfflineSpy.syncQueuedReviews.mockImplementation(async (callback: (item: unknown) => Promise<void>) => {
        await callback({ flashcardId: '1', quality: 5 });
        return { synced: 1, failed: 0 };
      });

      const promise = store.syncOfflineReviews();

      const req = httpMock.expectOne(`${environment.apiUrl}/flashcards/1/srs`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ quality: 5 });
      req.flush(mockFlashcard);

      const result = await promise;
      expect(result).toEqual({ synced: 1, failed: 0 });
    });
  });
});

