import { computed, ErrorHandler, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { AuthService } from './auth.service';
import { HtmlSanitisationService } from './html-sanitisation.service';
import { SrsOfflineService } from './srs-offline.service';
import { Flashcard, VocabularyStore } from './vocabulary.store';

describe('VocabularyStore signal reactivity', () => {
  let store: VocabularyStore;
  let online: ReturnType<typeof signal<boolean>>;

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

    TestBed.configureTestingModule({
      providers: [
        VocabularyStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getAccessToken: vi.fn().mockReturnValue('token') } },
        {
          provide: SrsOfflineService,
          useValue: {
            online,
            cacheFlashcards: vi.fn().mockResolvedValue(undefined),
            getCachedFlashcards: vi.fn().mockResolvedValue([]),
            cacheDueReviews: vi.fn().mockResolvedValue(undefined),
            getCachedDueReviews: vi.fn().mockResolvedValue([]),
            queueSrsReview: vi.fn().mockResolvedValue(undefined),
            syncQueuedReviews: vi.fn().mockResolvedValue({ synced: 0, failed: 0 }),
          },
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
  });

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

  it('tracks the reactive offline signal from SrsOfflineService', () => {
    expect(store.isOffline()).toBe(false);

    online.set(false);
    expect(store.isOffline()).toBe(true);

    online.set(true);
    expect(store.isOffline()).toBe(false);
  });

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
});
