<<<<<<< HEAD
import { Injectable, inject } from '@angular/core';
=======
import { Injectable, inject, ErrorHandler } from '@angular/core';
>>>>>>> origin/main
import { Flashcard } from './vocabulary.store';

interface QueuedReview {
  flashcardId: string;
  quality: number;
<<<<<<< HEAD
  newLevel: number;
  queuedAt: string;
}

@Injectable({ providedIn: 'root' })
export class SrsOfflineService {
  private readonly FLASHCARDS_CACHE_KEY = 'srs_flashcards_cache';
  private readonly DUE_REVIEWS_CACHE_KEY = 'srs_due_reviews_cache';
  private readonly QUEUED_REVIEWS_KEY = 'srs_queued_reviews';

  async cacheFlashcards(cards: Flashcard[]): Promise<void> {
    try {
      localStorage.setItem(this.FLASHCARDS_CACHE_KEY, JSON.stringify(cards));
    } catch {
      // Storage full or unavailable
=======
  srsLevel: number;
  timestamp: number;
}

const FLASHCARDS_CACHE_KEY = 'srs_flashcards_cache';
const DUE_REVIEWS_CACHE_KEY = 'srs_due_reviews_cache';
const OFFLINE_REVIEWS_KEY = 'srs_offline_reviews';

@Injectable({ providedIn: 'root' })
export class SrsOfflineService {
  private errorHandler = inject(ErrorHandler);

  async cacheFlashcards(cards: Flashcard[]): Promise<void> {
    try {
      localStorage.setItem(FLASHCARDS_CACHE_KEY, JSON.stringify(cards));
    } catch (err) {
      this.reportError('cacheFlashcards', err);
>>>>>>> origin/main
    }
  }

  async getCachedFlashcards(): Promise<Flashcard[]> {
    try {
<<<<<<< HEAD
      const raw = localStorage.getItem(this.FLASHCARDS_CACHE_KEY);
      return raw ? (JSON.parse(raw) as Flashcard[]) : [];
    } catch {
=======
      const raw = localStorage.getItem(FLASHCARDS_CACHE_KEY);
      if (!raw) return [];
      return this.parseFlashcardArray(raw);
    } catch (err) {
      this.reportError('getCachedFlashcards', err);
>>>>>>> origin/main
      return [];
    }
  }

  async cacheDueReviews(cards: Flashcard[]): Promise<void> {
    try {
<<<<<<< HEAD
      localStorage.setItem(this.DUE_REVIEWS_CACHE_KEY, JSON.stringify(cards));
    } catch {
      // Storage full or unavailable
=======
      localStorage.setItem(DUE_REVIEWS_CACHE_KEY, JSON.stringify(cards));
    } catch (err) {
      this.reportError('cacheDueReviews', err);
>>>>>>> origin/main
    }
  }

  async getCachedDueReviews(): Promise<Flashcard[]> {
    try {
<<<<<<< HEAD
      const raw = localStorage.getItem(this.DUE_REVIEWS_CACHE_KEY);
      return raw ? (JSON.parse(raw) as Flashcard[]) : [];
=======
      const raw = localStorage.getItem(DUE_REVIEWS_CACHE_KEY);
      if (!raw) return [];
      return this.parseFlashcardArray(raw);
    } catch (err) {
      this.reportError('getCachedDueReviews', err);
      return [];
    }
  }

  async queueSrsReview(
    flashcardId: string,
    quality: number,
    srsLevel: number,
  ): Promise<void> {
    try {
      const queue = this.getReviewQueue();
      queue.push({ flashcardId, quality, srsLevel, timestamp: Date.now() });
      localStorage.setItem(OFFLINE_REVIEWS_KEY, JSON.stringify(queue));
    } catch (err) {
      this.reportError('queueSrsReview', err);
    }
  }

  async syncQueuedReviews(
    syncFn: (review: QueuedReview) => Promise<void>,
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

    try {
      localStorage.setItem(OFFLINE_REVIEWS_KEY, JSON.stringify(remaining));
    } catch {
      // ignore storage errors during sync
    }

    return { synced, failed };
  }

  /**
   * Type guard: validates an unknown parsed value against the Flashcard interface shape.
   * Catches JSON.parse returning malformed data.
   */
  private isValidFlashcard(item: unknown): item is Flashcard {
    if (typeof item !== 'object' || item === null) return false;
    const obj: Record<string, unknown> = Object(item);
    return (
      typeof obj['id'] === 'string' &&
      typeof obj['user_id'] === 'string' &&
      typeof obj['word_token'] === 'string' &&
      typeof obj['translation'] === 'string' &&
      typeof obj['srs_level'] === 'number' &&
      typeof obj['easiness_factor'] === 'number' &&
      typeof obj['repetitions'] === 'number' &&
      typeof obj['interval_days'] === 'number' &&
      typeof obj['next_review_at'] === 'string' &&
      typeof obj['created_at'] === 'string'
    );
  }

  private parseFlashcardArray(raw: string): Flashcard[] {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item: unknown): item is Flashcard =>
      this.isValidFlashcard(item),
    );
  }

  private isValidQueuedReview(item: unknown): item is QueuedReview {
    if (typeof item !== 'object' || item === null) return false;
    const obj: Record<string, unknown> = Object(item);
    return (
      typeof obj['flashcardId'] === 'string' &&
      typeof obj['quality'] === 'number' &&
      typeof obj['srsLevel'] === 'number' &&
      typeof obj['timestamp'] === 'number'
    );
  }

  private getReviewQueue(): QueuedReview[] {
    try {
      const raw = localStorage.getItem(OFFLINE_REVIEWS_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item: unknown): item is QueuedReview =>
        this.isValidQueuedReview(item),
      );
>>>>>>> origin/main
    } catch {
      return [];
    }
  }

<<<<<<< HEAD
  async queueSrsReview(flashcardId: string, quality: number, newLevel: number): Promise<void> {
    try {
      const raw = localStorage.getItem(this.QUEUED_REVIEWS_KEY);
      const queue: QueuedReview[] = raw ? (JSON.parse(raw) as QueuedReview[]) : [];
      queue.push({
        flashcardId,
        quality,
        newLevel,
        queuedAt: new Date().toISOString(),
      });
      localStorage.setItem(this.QUEUED_REVIEWS_KEY, JSON.stringify(queue));
    } catch {
      // Storage full or unavailable
    }
  }

  async syncQueuedReviews(
    processReview: (review: QueuedReview) => Promise<void>,
  ): Promise<void> {
    try {
      const raw = localStorage.getItem(this.QUEUED_REVIEWS_KEY);
      if (!raw) return;

      const queue: QueuedReview[] = JSON.parse(raw) as QueuedReview[];
      for (const review of queue) {
        await processReview(review);
      }

      localStorage.removeItem(this.QUEUED_REVIEWS_KEY);
    } catch {
      // Silently fail - will retry on next online event
    }
=======
  private reportError(operation: string, err: unknown): void {
    const serviceError = new Error(
      `[SRS:SrsOfflineService] ${operation} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    serviceError.name = 'SrsOfflineError';
    this.errorHandler.handleError(serviceError);
>>>>>>> origin/main
  }
}