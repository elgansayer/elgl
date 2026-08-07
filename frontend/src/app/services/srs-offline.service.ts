import { Injectable } from '@angular/core';
import type { Flashcard } from './vocabulary.store';

interface SrsReviewQueueItem {
  flashcardId: string;
  quality: number;
  newLevel: number;
}

@Injectable({ providedIn: 'root' })
export class SrsOfflineService {
  async cacheFlashcards(_list: Flashcard[]): Promise<void> {
    // Stub: cache flashcards for offline use
  }

  async getCachedFlashcards(): Promise<Flashcard[]> {
    return [];
  }

  async cacheDueReviews(_list: Flashcard[]): Promise<void> {
    // Stub: cache due reviews for offline use
  }

  async getCachedDueReviews(): Promise<Flashcard[]> {
    return [];
  }

  async queueSrsReview(_flashcardId: string, _quality: number, _newLevel: number): Promise<void> {
    // Stub: queue SRS review for offline sync
  }

  async syncQueuedReviews(
    processor: (item: SrsReviewQueueItem) => Promise<void>,
  ): Promise<{ synced: number; failed: number }> {
    // Stub: sync queued reviews
    return { synced: 0, failed: 0 };
  }
}