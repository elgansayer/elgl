import { Injectable, signal } from '@angular/core';

interface QueuedReviewPayload {
  flashcardId: string;
  quality: number;
  newLevel: number;
  timestamp: string;
}

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

  /** Queue an SRS review operation for later sync when offline */
  async queueSrsReview(flashcardId: string, quality: number, newLevel: number): Promise<void> {
    const key = 'hellotalk_srs_queue';
    const queueJson = localStorage?.getItem(key);
    const queue: QueuedReviewPayload[] = queueJson ? JSON.parse(queueJson) : [];
    queue.push({
      flashcardId,
      quality,
      newLevel,
      timestamp: new Date().toISOString(),
    });
    localStorage?.setItem(key, JSON.stringify(queue));
    this.pendingSyncCount.set(queue.length);
  }

  /** Sync queued offline reviews to the backend */
  async syncQueuedReviews(
<<<<<<< HEAD
<<<<<<< HEAD
    _processor: (item: SrsReviewQueueItem) => Promise<void>,
=======
    syncFn: (review: QueuedReview) => Promise<void>,
>>>>>>> origin/main
  ): Promise<{ synced: number; failed: number }> {
    const queue = this.getReviewQueue();
    if (queue.length === 0) {
      return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;
    const remaining: QueuedReview[] = [];

    for (const review of queue) {
      try {
        await syncFn(review);
        synced++;
      } catch {
        failed++;
        remaining.push(review);
      }
    }
=======
    syncCallback: (queued: QueuedReviewPayload[]) => Promise<void>,
  ): Promise<void> {
    const key = 'hellotalk_srs_queue';
    const queueJson = localStorage?.getItem(key);
    if (!queueJson) return;
    const queue: QueuedReviewPayload[] = JSON.parse(queueJson);
    if (queue.length === 0) return;
>>>>>>> origin/main

    try {
      await syncCallback(queue);
      localStorage?.removeItem(key);
      this.pendingSyncCount.set(0);
    } catch {
      // Sync failed, keep queue for next attempt
    }
  }
}