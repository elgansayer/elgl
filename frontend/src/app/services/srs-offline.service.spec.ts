import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { SrsOfflineService } from './srs-offline.service';
import type { Flashcard } from './vocabulary.store';

describe('SrsOfflineService', () => {
  let service: SrsOfflineService;

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

  const mockFlashcard2: Flashcard = {
    id: '2',
    user_id: 'user1',
    word_token: 'world',
    translation: 'mundo',
    srs_level: 2,
    easiness_factor: 2.5,
    repetitions: 2,
    interval_days: 3,
    next_review_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [SrsOfflineService],
    });
    service = TestBed.inject(SrsOfflineService);
  });

  afterEach(async () => {
    await service.clearAll();
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('flashcard cache', () => {
    it('should cache and retrieve flashcards', async () => {
      await service.cacheFlashcards([mockFlashcard, mockFlashcard2]);

      const cached = await service.getCachedFlashcards();
      expect(cached.length).toBe(2);
      expect(cached[0].word_token).toBe('hello');
      expect(cached[1].word_token).toBe('world');
    });

    it('should update existing flashcards on re-cache', async () => {
      await service.cacheFlashcards([mockFlashcard]);
      const updated = { ...mockFlashcard, srs_level: 4 };
      await service.cacheFlashcards([updated]);

      const cached = await service.getCachedFlashcards();
      expect(cached.length).toBe(1);
      expect(cached[0].srs_level).toBe(4);
    });

    it('should return empty array when no cached flashcards exist', async () => {
      const cached = await service.getCachedFlashcards();
      expect(cached).toEqual([]);
    });
  });

  describe('due reviews cache', () => {
    it('should cache and retrieve due reviews, replacing previous', async () => {
      await service.cacheDueReviews([mockFlashcard]);
      await service.cacheDueReviews([mockFlashcard2]);

      const cached = await service.getCachedDueReviews();
      expect(cached.length).toBe(1);
      expect(cached[0].word_token).toBe('world');
    });

    it('should return empty array when no cached due reviews exist', async () => {
      const cached = await service.getCachedDueReviews();
      expect(cached).toEqual([]);
    });
  });

  describe('review queue', () => {
    it('should queue a review and return pending count', async () => {
      await service.queueSrsReview('1', 4, 2);
      expect(await service.getPendingReviewCount()).toBe(1);
    });

    it('should queue multiple reviews', async () => {
      await service.queueSrsReview('1', 4, 2);
      await service.queueSrsReview('2', 3, 0);
      expect(await service.getPendingReviewCount()).toBe(2);
    });

    it('should sync queued reviews and remove successful ones', async () => {
      await service.queueSrsReview('1', 4, 2);
      await service.queueSrsReview('2', 3, 0);

      const callback = vi.fn().mockResolvedValue(undefined);
      const result = await service.syncQueuedReviews(callback);

      expect(result.synced).toBe(2);
      expect(result.failed).toBe(0);
      expect(callback).toHaveBeenCalledTimes(2);
      expect(await service.getPendingReviewCount()).toBe(0);
    });

    it('should keep failed items in the queue', async () => {
      await service.queueSrsReview('1', 4, 2);
      await service.queueSrsReview('2', 3, 0);

      let callCount = 0;
      const callback = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw new Error('Network error');
        return Promise.resolve();
      });

      const result = await service.syncQueuedReviews(callback);

      expect(result.synced).toBe(1);
      expect(result.failed).toBe(1);
      expect(await service.getPendingReviewCount()).toBe(1);
    });

    it('should process reviews sorted oldest-first', async () => {
      // Directly insert items with controlled timestamps via the underlying store
      await service.queueSrsReview('first', 4, 2);
      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 5));
      await service.queueSrsReview('second', 3, 0);

      const processed: string[] = [];
      const callback = vi.fn().mockImplementation((item: { flashcardId: string }) => {
        processed.push(item.flashcardId);
        return Promise.resolve();
      });

      await service.syncQueuedReviews(callback);
      expect(processed[0]).toBe('first');
      expect(processed[1]).toBe('second');
    });
  });

  describe('clearAll', () => {
    it('should clear all caches and queue', async () => {
      await service.cacheFlashcards([mockFlashcard]);
      await service.cacheDueReviews([mockFlashcard2]);
      await service.queueSrsReview('1', 4, 2);

      await service.clearAll();

      expect(await service.getCachedFlashcards()).toEqual([]);
      expect(await service.getCachedDueReviews()).toEqual([]);
      expect(await service.getPendingReviewCount()).toBe(0);
    });
  });
});