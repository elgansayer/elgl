import { ErrorHandler, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { HtmlSanitisationService } from './html-sanitisation.service';
import { SrsOfflineService } from './srs-offline.service';
import { Flashcard, VocabularyStore } from './vocabulary.store';

describe('VocabularyStore signals', () => {
  let store: VocabularyStore;
  let http: HttpTestingController;

  const online = signal(true);
  const auth = {
    getAccessToken: vi.fn(() => 'access-token'),
  };
  const offline = {
    online,
    cacheFlashcards: vi.fn(() => Promise.resolve()),
    getCachedFlashcards: vi.fn(() => Promise.resolve([] as Flashcard[])),
    cacheDueReviews: vi.fn(() => Promise.resolve()),
    getCachedDueReviews: vi.fn(() => Promise.resolve([] as Flashcard[])),
    queueSrsReview: vi.fn(() => Promise.resolve()),
    syncQueuedReviews: vi.fn(
      async (sync: (item: { flashcardId: string; quality: number }) => Promise<void>) => {
        await sync({ flashcardId: 'card-1', quality: 4 });
        return { synced: 1, failed: 0 };
      },
    ),
  };
  const errorHandler = {
    handleError: vi.fn(),
  };
  const sanitisation = {
    sanitiseText: vi.fn((value: string) => value),
    sanitiseUrl: vi.fn((value: string) => value),
  };

  const card = (overrides: Partial<Flashcard> = {}): Flashcard => ({
    id: 'card-1',
    user_id: 'user-1',
    word_token: 'Hello',
    original_context: 'Hello there',
    translation: 'Hola',
    definition: 'A greeting',
    pronunciation_url: 'https://cdn.example.test/hello.mp3',
    srs_level: 1,
    easiness_factor: 2.5,
    repetitions: 1,
    interval_days: 1,
    next_review_at: '2026-08-22T00:00:00.000Z',
    created_at: '2026-08-20T00:00:00.000Z',
    ...overrides,
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    online.set(true);
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        VocabularyStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: SrsOfflineService, useValue: offline },
        { provide: ErrorHandler, useValue: errorHandler },
        { provide: HtmlSanitisationService, useValue: sanitisation },
      ],
    });

    store = TestBed.inject(VocabularyStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('starts with deterministic empty signal state', () => {
    expect(store.flashcardMap()).toEqual(new Map());
    expect(store.allFlashcards()).toEqual([]);
    expect(store.dueReviews()).toEqual([]);
    expect(store.pendingReviewCards()).toEqual([]);
    expect(store.isLoading()).toBe(false);
    expect(store.isDegraded()).toBe(false);
    expect(store.degradedReason()).toBe('');
    expect(store.isOffline()).toBe(false);
  });

  it('reacts to online state changes through the computed isOffline signal', () => {
    expect(store.isOffline()).toBe(false);
    online.set(false);
    expect(store.isOffline()).toBe(true);
    online.set(true);
    expect(store.isOffline()).toBe(false);
  });

  it('loads cards, normalises map keys and caches the sanitised result', async () => {
    const loading = store.loadAllFlashcards();
    expect(store.isLoading()).toBe(true);

    const request = http.expectOne(`${environment.apiUrl}/flashcards`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-token');
    request.flush([card()]);

    await loading;

    expect(store.isLoading()).toBe(false);
    expect(store.allFlashcards()).toEqual([card()]);
    expect(store.flashcardMap().get('hello')).toEqual(card());
    expect(store.flashcardMap().has('Hello')).toBe(false);
    expect(offline.cacheFlashcards).toHaveBeenCalledWith([card()]);
    expect(sanitisation.sanitiseText).toHaveBeenCalledWith('Hello');
  });

  it('reports load failures and restores cached cards while offline', async () => {
    const cached = card({ id: 'cached-1', word_token: 'Offline' });
    online.set(false);
    offline.getCachedFlashcards.mockResolvedValueOnce([cached]);

    const loading = store.loadAllFlashcards();
    http
      .expectOne(`${environment.apiUrl}/flashcards`)
      .flush({ error: 'unavailable' }, { status: 503, statusText: 'Unavailable' });
    await loading;

    expect(errorHandler.handleError).toHaveBeenCalledOnce();
    expect(offline.getCachedFlashcards).toHaveBeenCalledOnce();
    expect(store.allFlashcards()).toEqual([cached]);
    expect(store.flashcardMap().get('offline')).toEqual(cached);
    expect(store.isLoading()).toBe(false);
  });

  it('loads and caches due reviews', async () => {
    const due = card({ id: 'due-1', word_token: 'Due' });
    const loading = store.loadDueReviews();

    const request = http.expectOne(`${environment.apiUrl}/flashcards/due`);
    expect(request.request.method).toBe('GET');
    request.flush([due]);
    await loading;

    expect(store.dueReviews()).toEqual([due]);
    expect(offline.cacheDueReviews).toHaveBeenCalledWith([due]);
  });

  it('restores cached due reviews when the network is unavailable offline', async () => {
    const due = card({ id: 'cached-due', word_token: 'Cached due' });
    online.set(false);
    offline.getCachedDueReviews.mockResolvedValueOnce([due]);

    const loading = store.loadDueReviews();
    http
      .expectOne(`${environment.apiUrl}/flashcards/due`)
      .flush({ error: 'offline' }, { status: 0, statusText: 'Offline' });
    await loading;

    expect(errorHandler.handleError).toHaveBeenCalledOnce();
    expect(store.dueReviews()).toEqual([due]);
  });

  describe('word status', () => {
    it('maps an unknown token to new level 0 styling', () => {
      const status = store.getWordStatus(' new ');
      expect(status.level).toBe(0);
      expect(status.flashcard).toBeUndefined();
      expect(status.colorClass).toContain('bg-secondary/20');
      expect(status.colourClass).toBe(status.colorClass);
    });

    it('maps levels 1-3 to learning styling case-insensitively', () => {
      const learning = card({ srs_level: 3 });
      store.flashcardMap.set(new Map([['hello', learning]]));

      const status = store.getWordStatus('  HELLO  ');
      expect(status.level).toBe(3);
      expect(status.flashcard).toEqual(learning);
      expect(status.colorClass).toContain('bg-warning/20');
    });

    it('maps level 4 and above to known styling', () => {
      const known = card({ srs_level: 4 });
      store.flashcardMap.set(new Map([['hello', known]]));

      const status = store.getWordStatus('hello');
      expect(status.level).toBe(4);
      expect(status.flashcard).toEqual(known);
      expect(status.colorClass).toContain('text-text-primary');
    });
  });

  it('saves a word and atomically updates both card signals', async () => {
    const old = card();
    const saved = card({ id: 'card-2', word_token: 'World', translation: 'Mundo' });
    store.allFlashcards.set([old]);
    store.flashcardMap.set(new Map([['hello', old]]));

    const saving = store.saveWord({
      word_token: 'World',
      translation: 'Mundo',
      original_context: 'World!',
    });

    const request = http.expectOne(`${environment.apiUrl}/flashcards`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-token');
    request.flush(saved);

    await expect(saving).resolves.toEqual(saved);
    expect(store.allFlashcards()).toEqual([saved, old]);
    expect(store.flashcardMap().get('world')).toEqual(saved);
  });

  it('replaces an existing token instead of duplicating it when saveWord is retried', async () => {
    const existing = card();
    const saved = card({ translation: 'Updated translation' });
    store.allFlashcards.set([existing]);
    store.flashcardMap.set(new Map([['hello', existing]]));

    const saving = store.saveWord({ word_token: 'Hello', translation: 'Updated translation' });
    http.expectOne(`${environment.apiUrl}/flashcards`).flush(saved);
    await saving;

    expect(store.allFlashcards()).toHaveLength(1);
    expect(store.allFlashcards()[0]).toEqual(saved);
    expect(store.flashcardMap().get('hello')).toEqual(saved);
  });

  it('updates SRS state from the server response in both reactive collections', async () => {
    const existing = card();
    const updated = card({ srs_level: 2, repetitions: 2 });
    store.allFlashcards.set([existing]);
    store.flashcardMap.set(new Map([['hello', existing]]));

    const updating = store.updateSrsLevel(existing.id, 4);
    const request = http.expectOne(`${environment.apiUrl}/flashcards/${existing.id}/srs`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ quality: 4 });
    request.flush(updated);

    await expect(updating).resolves.toEqual(updated);
    expect(store.allFlashcards()[0]).toEqual(updated);
    expect(store.flashcardMap().get('hello')).toEqual(updated);
  });

  it('queues and optimistically updates an SRS review when offline', async () => {
    const existing = card({ srs_level: 1 });
    online.set(false);
    store.allFlashcards.set([existing]);
    store.flashcardMap.set(new Map([['hello', existing]]));

    const updating = store.updateSrsLevel(existing.id, 4);
    http
      .expectOne(`${environment.apiUrl}/flashcards/${existing.id}/srs`)
      .flush({ error: 'offline' }, { status: 0, statusText: 'Offline' });

    const result = await updating;
    expect(offline.queueSrsReview).toHaveBeenCalledWith(existing.id, 4, 2);
    expect(result.srs_level).toBe(2);
    expect(store.allFlashcards()[0].srs_level).toBe(2);
    expect(store.flashcardMap().get('hello')?.srs_level).toBe(2);
  });

  it('rejects an SRS update when online and the server fails', async () => {
    const existing = card();
    store.allFlashcards.set([existing]);

    const updating = store.updateSrsLevel(existing.id, 4);
    http
      .expectOne(`${environment.apiUrl}/flashcards/${existing.id}/srs`)
      .flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });

    await expect(updating).rejects.toThrow('Failed to update SRS level');
    expect(offline.queueSrsReview).not.toHaveBeenCalled();
  });

  it('syncs queued reviews through the authenticated SRS endpoint', async () => {
    const syncing = store.syncOfflineReviews();

    const request = http.expectOne(`${environment.apiUrl}/flashcards/card-1/srs`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ quality: 4 });
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-token');
    request.flush(card({ srs_level: 2 }));

    await expect(syncing).resolves.toEqual({ synced: 1, failed: 0 });
  });

  it('returns the translation result without mutating vocabulary state', async () => {
    const translating = store.translateWordOrSentence('hello', 'es', 'en');
    const request = http.expectOne(`${environment.apiUrl}/nlp/translate`);
    expect(request.request.body).toEqual({
      text: 'hello',
      target_language: 'es',
      source_language: 'en',
    });
    request.flush({
      original_text: 'hello',
      translated_text: 'hola',
      detected_language: 'en',
    });

    await expect(translating).resolves.toEqual({
      original_text: 'hello',
      translated_text: 'hola',
      detected_language: 'en',
    });
    expect(store.allFlashcards()).toEqual([]);
    expect(store.isDegraded()).toBe(false);
  });

  it('marks NLP state degraded and returns a safe translation fallback on failure', async () => {
    const translating = store.translateWordOrSentence('hello', 'es');
    http
      .expectOne(`${environment.apiUrl}/nlp/translate`)
      .flush({ error: 'rate limited' }, { status: 429, statusText: 'Too Many Requests' });

    const result = await translating;
    expect(store.isDegraded()).toBe(true);
    expect(result.original_text).toBe('hello');
    expect(result.translated_text).toBe('hello');
    expect(result.definition).toContain('unavailable');
  });

  it('uses safe fallbacks for grammar and pronunciation outages', async () => {
    const grammar = store.checkGrammar('I has a cat', 'en');
    http
      .expectOne(`${environment.apiUrl}/nlp/grammar-check`)
      .flush({ error: 'down' }, { status: 503, statusText: 'Unavailable' });
    await expect(grammar).resolves.toMatchObject({
      original: 'I has a cat',
      corrected: 'I has a cat',
      errors_found: 0,
    });

    const pronunciation = store.scorePronunciation('https://audio.test/a.mp3', 'hello', 'en');
    http
      .expectOne(`${environment.apiUrl}/nlp/pronunciation-score`)
      .flush({ error: 'down' }, { status: 503, statusText: 'Unavailable' });
    await expect(pronunciation).resolves.toMatchObject({
      overall_score: 85,
      breakdown: [{ word: 'hello', score: 85 }],
    });

    expect(store.isDegraded()).toBe(true);
  });
});
