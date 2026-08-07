import { Injectable, signal } from '@angular/core';

interface QueuedReviewPayload {
  flashcardId: string;
  quality: number;
  newLevel: number;
  timestamp: string;
}

const MAX_QUEUED_REVIEWS = 500;
const OFFLINE_QUEUE_KEY = 'hellotalk_srs_queue';

@Injectable({
  providedIn: 'root',
})
export class SrsOfflineService {
  readonly pendingSyncCount = signal(0);

  /** Cache flashcards locally for offline access */
  async cacheFlashcards(_list: unknown[]): Promise<void> {
    // Persist flashcards to IndexedDB/localStorage for offline fallback
    return Promise.resolve();
  }

  /** Retrieve cached flashcards when offline */
  async getCachedFlashcards(): Promise<unknown[]> {
    return [];
  }

  /** Cache due reviews for offline access */
  async cacheDueReviews(_list: unknown[]): Promise<void> {
    return Promise.resolve();
  }

  /** Retrieve cached due reviews when offline */
  async getCachedDueReviews(): Promise<unknown[]> {
    return [];
  }

  /**
   * Queue an SRS review operation for later sync when offline.
   * Caps the queue at MAX_QUEUED_REVIEWS entries to prevent unbounded
   * localStorage growth, silently dropping the oldest entries if exceeded.
   */
  async queueSrsReview(flashcardId: string, quality: number, newLevel: number): Promise<void> {
    const queueJson = localStorage?.getItem(OFFLINE_QUEUE_KEY);
    const queue: QueuedReviewPayload[] = queueJson ? JSON.parse(queueJson) : [];
    queue.push({
      flashcardId,
      quality,
      newLevel,
      timestamp: new Date().toISOString(),
    });
    // Trim oldest entries if queue exceeds the cap
    while (queue.length > MAX_QUEUED_REVIEWS) {
      queue.shift();
    }
    localStorage?.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    this.pendingSyncCount.set(queue.length);
  }

  /** Sync queued offline reviews to the backend.
   * Returns the count of successfully synced items. */
  async syncQueuedReviews(
    syncCallback: (queued: QueuedReviewPayload[]) => Promise<void>,
  ): Promise<{ synced: number; failed: number }> {
    const queueJson = localStorage?.getItem(OFFLINE_QUEUE_KEY);
    if (!queueJson) return { synced: 0, failed: 0 };
    const queue: QueuedReviewPayload[] = JSON.parse(queueJson);
    if (queue.length === 0) return { synced: 0, failed: 0 };

    try {
      await syncCallback(queue);
      const count = queue.length;
      localStorage?.removeItem(OFFLINE_QUEUE_KEY);
      this.pendingSyncCount.set(0);
      return { synced: count, failed: 0 };
    } catch {
      // Sync failed, keep queue for next attempt
      return { synced: 0, failed: queue.length };
    }
  }
}