import { computed, ErrorHandler, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { AuthService } from './auth.service';
import { HtmlSanitisationService } from './html-sanitisation.service';
import { SrsOfflineService } from './srs-offline.service';
import { Flashcard, VocabularyStore } from './vocabulary.store';
import { environment } from '../../environments/environment';

describe('VocabularyStore signal reactivity', () => {
  let store: VocabularyStore;
  let httpMock: HttpTestingController;
  let online: ReturnType<typeof signal<boolean>>;
  let srsOfflineMock: {
    online: ReturnType<typeof signal<boolean>>;
    cacheFlashcards: ReturnType<typeof vi.fn>;
    getCachedFlashcards: ReturnType<typeof vi.fn>;
    cacheDueReviews: ReturnType<typeof vi.fn>;
    getCachedDueReviews: ReturnType<typeof vi.fn>;
    queueSrsReview: ReturnType<typeof vi.fn>;
    syncQueuedReviews: ReturnType<typeof vi.fn>;
  };

  const flashcard = (overrides: Partial<Flashcard> = {}): Flashcard => ({
    id: 'card-1',
    user_id: 'user-1',
    word_token: 'hello',
    translation: 'hola',
    srs_level: 1,
    easiness_factor: 2.5,
    repetitions: 1,
    interval_days: 1,
    next_review_at: '2026-08-27T00:00:00.000Z',
    created_at: '2026-08-26T00:00:00.000Z',
    ...overrides,
  });

  beforeEach(() => {
    online = signal(true);
    srsOfflineMock = {
      online,
      cacheFlashcards: vi.fn().mockResolvedValue(undefined),
      getCachedFlashcards: vi.fn().mockResolvedValue([]),
      cacheDueReviews: vi.fn().mockResolvedValue(undefined),
      getCachedDueReviews: vi.fn().mockResolvedValue([]),
      queueSrsReview: vi.fn().mockResolvedValue(undefined),
      syncQueuedReviews: vi.fn().mockResolvedValue({ synced: 0, failed: 0 }),
    };

    TestBed.configureTestingModule({
      providers: [
        VocabularyStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getAccessToken: vi.fn().mockReturnValue('token') } },
        {
          provide: SrsOfflineService,
          useValue: srsOfflineMock,
        },
        {
          provide: HtmlSanitisationService,
          useValue: {
            sanitiseText: vi.fn((value: string) => value),
            sanitiseUrl: vi.fn((value: string) => value),
          },
        },
        { provide: ErrorHandler, useValue: { handleError: vi.fn() } },
      ],
    });

    store = TestBed.inject(VocabularyStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  describe('initial signal values', () => {
    it('initialises all signals with expected defaults', () => {
      expect(store.allFlashcards()).toEqual([]);
      expect(store.flashcardMap().size).toBe(0);
      expect(store.dueReviews()).toEqual([]);
      expect(store.pendingReviewCards()).toEqual([]);
      expect(store.isLoading()).toBe(false);
      expect(store.isDegraded()).toBe(false);
      expect(store.degradedReason()).toBe('');
      expect(store.isOffline()).toBe(false);
    });
  });

  describe('allFlashcards and flashcardMap signals', () => {
    it('recomputes consumers when allFlashcards changes', () => {
      const learningCount = computed(
        () => store.allFlashcards().filter((card) => card.srs_level > 0 && card.srs_level < 4).length,
      );

      expect(learningCount()).toBe(0);

      store.allFlashcards.set([flashcard(), flashcard({ id: 'card-2', word_token: 'known', srs_level: 4 })]);
      expect(learningCount()).toBe(1);

      store.allFlashcards.update((cards) => [
        ...cards,
        flashcard({ id: 'card-3', word_token: 'learning', srs_level: 2 }),
      ]);
      expect(learningCount()).toBe(2);
    });

    it('recomputes getWordStatus consumers when flashcardMap is replaced', () => {
      const helloLevel = computed(() => store.getWordStatus(' Hello ').level);

      expect(helloLevel()).toBe(0);

      store.flashcardMap.update((current) => {
        const next = new Map(current);
        next.set('hello', flashcard({ srs_level: 2 }));
        return next;
      });
      expect(helloLevel()).toBe(2);

      store.flashcardMap.update((current) => {
        const next = new Map(current);
        next.set('hello', flashcard({ srs_level: 4 }));
        return next;
      });
      expect(helloLevel()).toBe(4);
    });

    it('updates allFlashcards and flashcardMap signals reactively when saveWord succeeds', async () => {
      const initialCard = flashcard({ id: 'card-1', word_token: 'hello', translation: 'hola' });
      store.allFlashcards.set([initialCard]);
      store.flashcardMap.set(new Map([['hello', initialCard]]));

      const newCard = flashcard({ id: 'card-2', word_token: 'world', translation: 'mundo' });
      const savePromise = store.saveWord({ word_token: 'world', translation: 'mundo' });

      const req = httpMock.expectOne(`${environment.apiUrl}/flashcards`);
      expect(req.request.method).toBe('POST');
      req.flush(newCard);

      await savePromise;

      expect(store.allFlashcards()).toHaveLength(2);
      expect(store.allFlashcards()[0]).toEqual(newCard);
      expect(store.flashcardMap().get('world')).toEqual(newCard);
    });

    it('updates allFlashcards and flashcardMap signals reactively when updateSrsLevel succeeds', async () => {
      const initialCard = flashcard({ id: 'card-1', word_token: 'hello', srs_level: 1 });
      store.allFlashcards.set([initialCard]);
      store.flashcardMap.set(new Map([['hello', initialCard]]));

      const updatedCard = { ...initialCard, srs_level: 3 };
      const updatePromise = store.updateSrsLevel('card-1', 4);

      const req = httpMock.expectOne(`${environment.apiUrl}/flashcards/card-1/srs`);
      expect(req.request.method).toBe('PATCH');
      req.flush(updatedCard);

      await updatePromise;

      expect(store.allFlashcards()[0].srs_level).toBe(3);
      expect(store.flashcardMap().get('hello')?.srs_level).toBe(3);
      expect(store.getWordStatus('hello').level).toBe(3);
    });

    it('populates allFlashcards and flashcardMap from offline cache when loadAllFlashcards fails offline', async () => {
      online.set(false);
      const cached = [flashcard({ id: 'cached-1', word_token: 'offline' })];
      srsOfflineMock.getCachedFlashcards.mockResolvedValue(cached);

      const loadPromise = store.loadAllFlashcards();
      const req = httpMock.expectOne(`${environment.apiUrl}/flashcards`);
      req.flush('Offline error', { status: 0, statusText: 'Offline' });

      await loadPromise;

      expect(store.allFlashcards()).toEqual(cached);
      expect(store.flashcardMap().get('offline')).toEqual(cached[0]);
    });

    it('optimistically updates allFlashcards and flashcardMap signals when updateSrsLevel fails offline', async () => {
      online.set(false);
      const card = flashcard({ id: 'card-1', word_token: 'test', srs_level: 1 });
      store.allFlashcards.set([card]);
      store.flashcardMap.set(new Map([['test', card]]));

      const updatePromise = store.updateSrsLevel('card-1', 4);
      const req = httpMock.expectOne(`${environment.apiUrl}/flashcards/card-1/srs`);
      req.flush('Offline error', { status: 0, statusText: 'Offline' });

      const result = await updatePromise;

      expect(result.srs_level).toBe(2);
      expect(store.allFlashcards()[0].srs_level).toBe(2);
      expect(store.flashcardMap().get('test')?.srs_level).toBe(2);
    });
  });

  describe('isOffline computed signal', () => {
    it('tracks the reactive offline signal from SrsOfflineService', () => {
      expect(store.isOffline()).toBe(false);

      online.set(false);
      expect(store.isOffline()).toBe(true);

      online.set(true);
      expect(store.isOffline()).toBe(false);
    });
  });

  describe('pendingReviewCards and dueReviews signals', () => {
    it('keeps review-session signals independent from the main vocabulary collection', () => {
      const vocabularyCard = flashcard();
      const reviewCard = flashcard({ id: 'review-card', word_token: 'review' });

      store.allFlashcards.set([vocabularyCard]);
      store.pendingReviewCards.set([reviewCard]);
      store.dueReviews.set([reviewCard]);

      expect(store.allFlashcards()).toEqual([vocabularyCard]);
      expect(store.pendingReviewCards()).toEqual([reviewCard]);
      expect(store.dueReviews()).toEqual([reviewCard]);

      store.pendingReviewCards.set([]);
      expect(store.pendingReviewCards()).toEqual([]);
      expect(store.allFlashcards()).toEqual([vocabularyCard]);
      expect(store.dueReviews()).toEqual([reviewCard]);
    });

    it('recomputes consumers when dueReviews changes', () => {
      const dueCount = computed(() => store.dueReviews().length);
      expect(dueCount()).toBe(0);

      store.dueReviews.set([flashcard()]);
      expect(dueCount()).toBe(1);
    });

    it('recomputes consumers when pendingReviewCards changes', () => {
      const pendingCount = computed(() => store.pendingReviewCards().length);
      expect(pendingCount()).toBe(0);

      store.pendingReviewCards.set([flashcard()]);
      expect(pendingCount()).toBe(1);
    });

    it('populates dueReviews signal from HTTP endpoint upon loadDueReviews', async () => {
      const dueCards = [flashcard({ id: 'due-1', word_token: 'due' })];
      const loadPromise = store.loadDueReviews();

      const req = httpMock.expectOne(`${environment.apiUrl}/flashcards/due`);
      req.flush(dueCards);

      await loadPromise;
      expect(store.dueReviews()).toEqual(dueCards);
    });

    it('populates dueReviews signal from offline cache when loadDueReviews fails offline', async () => {
      online.set(false);
      const cached = [flashcard({ id: 'due-cached', word_token: 'due-cached' })];
      srsOfflineMock.getCachedDueReviews.mockResolvedValue(cached);

      const loadPromise = store.loadDueReviews();
      const req = httpMock.expectOne(`${environment.apiUrl}/flashcards/due`);
      req.flush('Offline error', { status: 0, statusText: 'Offline' });

      await loadPromise;
      expect(store.dueReviews()).toEqual(cached);
    });
  });

  describe('isLoading, isDegraded, and degradedReason signals', () => {
    it('keeps loading and degraded-state signals independently writable', () => {
      expect(store.isLoading()).toBe(false);
      expect(store.isDegraded()).toBe(false);
      expect(store.degradedReason()).toBe('');

      store.isLoading.set(true);
      store.isDegraded.set(true);
      store.degradedReason.set('provider-unavailable');

      expect(store.isLoading()).toBe(true);
      expect(store.isDegraded()).toBe(true);
      expect(store.degradedReason()).toBe('provider-unavailable');
    });

    it('transitions isLoading signal correctly across loadAllFlashcards lifecycle', async () => {
      expect(store.isLoading()).toBe(false);

      const loadPromise = store.loadAllFlashcards();
      expect(store.isLoading()).toBe(true);

      const req = httpMock.expectOne(`${environment.apiUrl}/flashcards`);
      req.flush([flashcard()]);

      await loadPromise;
      expect(store.isLoading()).toBe(false);
    });

    it('resets isLoading signal to false even when loadAllFlashcards encounters an error', async () => {
      expect(store.isLoading()).toBe(false);

      const loadPromise = store.loadAllFlashcards();
      expect(store.isLoading()).toBe(true);

      const req = httpMock.expectOne(`${environment.apiUrl}/flashcards`);
      req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

      await loadPromise;
      expect(store.isLoading()).toBe(false);
    });

    it('sets isDegraded signal when translateWordOrSentence encounters an error', async () => {
      expect(store.isDegraded()).toBe(false);

      const translatePromise = store.translateWordOrSentence('bonjour', 'en');
      const req = httpMock.expectOne(`${environment.apiUrl}/nlp/translate`);
      req.flush('Error', { status: 500, statusText: 'Server Error' });

      const result = await translatePromise;
      expect(store.isDegraded()).toBe(true);
      expect(result.translated_text).toBe('bonjour');
    });

    it('maintains isDegraded as false when translateWordOrSentence succeeds', async () => {
      expect(store.isDegraded()).toBe(false);

      const translatePromise = store.translateWordOrSentence('bonjour', 'en');
      const req = httpMock.expectOne(`${environment.apiUrl}/nlp/translate`);
      req.flush({
        original_text: 'bonjour',
        translated_text: 'hello',
        detected_language: 'fr',
      });

      const result = await translatePromise;
      expect(store.isDegraded()).toBe(false);
      expect(result.translated_text).toBe('hello');
    });

    it('sets isDegraded signal when checkGrammar encounters an error', async () => {
      expect(store.isDegraded()).toBe(false);

      const checkPromise = store.checkGrammar('test sentence');
      const req = httpMock.expectOne(`${environment.apiUrl}/nlp/grammar-check`);
      req.flush('Error', { status: 500, statusText: 'Server Error' });

      await checkPromise;
      expect(store.isDegraded()).toBe(true);
    });

    it('sets isDegraded signal when scorePronunciation encounters an error', async () => {
      expect(store.isDegraded()).toBe(false);

      const scorePromise = store.scorePronunciation('audio.mp3', 'test');
      const req = httpMock.expectOne(`${environment.apiUrl}/nlp/pronunciation-score`);
      req.flush('Error', { status: 500, statusText: 'Server Error' });

      await scorePromise;
      expect(store.isDegraded()).toBe(true);
    });
  });
});
