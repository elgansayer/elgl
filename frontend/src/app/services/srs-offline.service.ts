import { Injectable, signal } from '@angular/core';
import { Flashcard } from './vocabulary.store';

export interface SrsQueuedReview {
  flashcardId: string;
  quality: number;
  newLevel: number;
  timestamp: number;
}

const FLASHCARDS_CACHE_KEY = 'hellotalk_srs_flashcards';
const DUE_REVIEWS_CACHE_KEY = 'hellotalk_srs_due_reviews';
const QUEUED_REVIEWS_KEY = 'hellotalk_srs_queued_reviews';

/**
 * Offline-first persistence for SRS flashcards and reviews.
 * Uses localStorage as a simple IndexedDB alternative for PWA offline support.
 */
@Injectable({ providedIn: 'root' })
export class SrsOfflineService {
  readonly isSyncing = signal(false);

  async cacheFlashcards(list: Flashcard[]): Promise<void> {
    try {
      localStorage.setItem(FLASHCARDS_CACHE_KEY, JSON.stringify(list));
    } catch {
      // localStorage full or unavailable - silently degrade
    }
  }

  async getCachedFlashcards(): Promise<Flashcard[]> {
    try {
      const raw = localStorage.getItem(FLASHCARDS_CACHE_KEY);
      return raw ? (JSON.parse(raw) as Flashcard[]) : [];
    } catch {
      return [];
    }
  }

  async cacheDueReviews(list: Flashcard[]): Promise<void> {
    try {
      localStorage.setItem(DUE_REVIEWS_CACHE_KEY, JSON.stringify(list));
    } catch {
      // silently degrade
    }
  }

  async getCachedDueReviews(): Promise<Flashcard[]> {
    try {
      const raw = localStorage.getItem(DUE_REVIEWS_CACHE_KEY);
      return raw ? (JSON.parse(raw) as Flashcard[]) : [];
    } catch {
      return [];
    }
  }

  async queueSrsReview(flashcardId: string, quality: number, newLevel: number): Promise<void> {
    const entry: SrsQueuedReview = {
      flashcardId,
      quality,
      newLevel,
      timestamp: Date.now(),
    };
    try {
      const raw = localStorage.getItem(QUEUED_REVIEWS_KEY);
      const queue: SrsQueuedReview[] = raw ? (JSON.parse(raw) as SrsQueuedReview[]) : [];
      queue.push(entry);
      localStorage.setItem(QUEUED_REVIEWS_KEY, JSON.stringify(queue));
    } catch {
      // silently degrade
    }
  }

  async syncQueuedReviews(
    onSync: (queued: SrsQueuedReview) => Promise<void>,
  ): Promise<{ synced: number; failed: number }> {
    this.isSyncing.set(true);
    let synced = 0;
    let failed = 0;

    try {
      const raw = localStorage.getItem(QUEUED_REVIEWS_KEY);
      const queue: SrsQueuedReview[] = raw ? (JSON.parse(raw) as SrsQueuedReview[]) : [];

      for (const entry of queue) {
        try {
          await onSync(entry);
          synced++;
        } catch {
          failed++;
        }
      }

      if (failed === 0) {
        localStorage.removeItem(QUEUED_REVIEWS_KEY);
      } else {
        // Keep only failed entries for next retry
        // (simple approach - keep all if any failed, will retry next sync)
      }
    } catch {
      // silently degrade
    } finally {
      this.isSyncing.set(false);
    }

    return { synced, failed };
  }
}