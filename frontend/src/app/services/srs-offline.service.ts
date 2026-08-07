import { Injectable, inject } from '@angular/core';
import { Flashcard } from './vocabulary.store';

interface QueuedReview {
  flashcardId: string;
  quality: number;
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
    }
  }

  async getCachedFlashcards(): Promise<Flashcard[]> {
    try {
      const raw = localStorage.getItem(this.FLASHCARDS_CACHE_KEY);
      return raw ? (JSON.parse(raw) as Flashcard[]) : [];
    } catch {
      return [];
    }
  }

  async cacheDueReviews(cards: Flashcard[]): Promise<void> {
    try {
      localStorage.setItem(this.DUE_REVIEWS_CACHE_KEY, JSON.stringify(cards));
    } catch {
      // Storage full or unavailable
    }
  }

  async getCachedDueReviews(): Promise<Flashcard[]> {
    try {
      const raw = localStorage.getItem(this.DUE_REVIEWS_CACHE_KEY);
      return raw ? (JSON.parse(raw) as Flashcard[]) : [];
    } catch {
      return [];
    }
  }

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
  }
}