import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { SrsOfflineService } from './srs-offline.service';
import { Flashcard } from './vocabulary.store';

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

describe('SrsOfflineService', () => {
  let service: SrsOfflineService;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state (no IndexedDB)', () => {
    beforeEach(() => {
      vi.stubGlobal('indexedDB', undefined);
    });

    it('should create', () => {
      service = new SrsOfflineService();
      expect(service).toBeTruthy();
    });

    it('should initialise pendingSyncCount as 0', () => {
      service = new SrsOfflineService();
      expect(service.pendingSyncCount()).toBe(0);
    });
  });

  describe('SSR guard (no IndexedDB)', () => {
    beforeEach(() => {
      vi.stubGlobal('indexedDB', undefined);
      service = new SrsOfflineService();
    });

    it('should return empty array for getCachedFlashcards when no IndexedDB', async () => {
      const result = await service.getCachedFlashcards();
      expect(result).toEqual([]);
    });

    it('should return empty array for getCachedDueReviews when no IndexedDB', async () => {
      const result = await service.getCachedDueReviews();
      expect(result).toEqual([]);
    });

    it('should not throw when cacheFlashcards called without IndexedDB', async () => {
      await expect(service.cacheFlashcards([mockFlashcard])).resolves.toBeUndefined();
    });

    it('should not throw when cacheDueReviews called without IndexedDB', async () => {
      await expect(service.cacheDueReviews([mockFlashcard])).resolves.toBeUndefined();
    });

    it('should not throw when queueSrsReview called without IndexedDB', async () => {
      await expect(service.queueSrsReview('1', 4, 2)).resolves.toBeUndefined();
    });

    it('should return zeros from syncQueuedReviews without IndexedDB', async () => {
      const result = await service.syncQueuedReviews(async () => {});
      expect(result).toEqual({ synced: 0, failed: 0 });
    });

    it('should handle multiple parallel operations without IndexedDB', async () => {
      const results = await Promise.all([
        service.getCachedFlashcards(),
        service.getCachedDueReviews(),
        service.cacheFlashcards([mockFlashcard]),
        service.cacheDueReviews([mockFlashcard]),
        service.queueSrsReview('1', 3, 1),
        service.syncQueuedReviews(vi.fn()),
      ]);
      expect(results[0]).toEqual([]);
      expect(results[1]).toEqual([]);
      expect(results[5]).toEqual({ synced: 0, failed: 0 });
    });
  });
});
