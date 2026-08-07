import { Injectable } from '@angular/core';
import { Flashcard } from './vocabulary.store';

export interface SrsReviewQueueItem {
  flashcardId: string;
  quality: number;
  newLevel: number;
}

@Injectable({
  providedIn: 'root',
})
export class SrsOfflineService {
  async cacheFlashcards(_list: Flashcard[]): Promise<void> {
    // Persist flashcards to local storage for offline access
  }

  async getCachedFlashcards(): Promise<Flashcard[]> {
    return [];
  }

  async cacheDueReviews(_list: Flashcard[]): Promise<void> {
    // Persist due reviews to local storage
  }

  async getCachedDueReviews(): Promise<Flashcard[]> {
    return [];
  }

  async queueSrsReview(
    _flashcardId: string,
    _quality: number,
    _newLevel: number,
  ): Promise<void> {
    // Queue SRS review for later sync
  }

  async syncQueuedReviews(
    _processFn: (queued: SrsReviewQueueItem) => Promise<void>,
  ): Promise<{ synced: number; failed: number }> {
    return { synced: 0, failed: 0 };
  }
}