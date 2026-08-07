import { Injectable, inject, signal, ErrorHandler } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';
import type { Flashcard } from './vocabulary.store';

interface SrsReviewQueueItem {
  id?: number;
  flashcardId: string;
  quality: number;
  newLevel: number;
  timestamp: number;
}

const DB_NAME = 'SrsOfflineDB';
const DB_VERSION = 1;
const STORE_FLASHCARDS = 'cachedFlashcards';
const STORE_DUE_REVIEWS = 'cachedDueReviews';
const STORE_REVIEW_QUEUE = 'reviewQueue';

@Injectable({ providedIn: 'root' })
export class SrsOfflineService {
  private errorHandler = inject(ErrorHandler);
  private dbPromise: Promise<IDBPDatabase<unknown>> | null = null;

  /** Exposes the current online status reactively. */
  readonly online = signal<boolean>(navigator.onLine);

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.online.set(true));
      window.addEventListener('offline', () => this.online.set(false));
    }
  }

  // ---------------------------------------------------------------------------
  // DB helpers
  // ---------------------------------------------------------------------------

  private getDB(): Promise<IDBPDatabase<unknown>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db: IDBPDatabase<unknown>) {
          if (!db.objectStoreNames.contains(STORE_FLASHCARDS)) {
            db.createObjectStore(STORE_FLASHCARDS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_DUE_REVIEWS)) {
            db.createObjectStore(STORE_DUE_REVIEWS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_REVIEW_QUEUE)) {
            db.createObjectStore(STORE_REVIEW_QUEUE, {
              keyPath: 'id',
              autoIncrement: true,
            });
          }
        },
      });
    }
    return this.dbPromise;
  }

  private async reportError(operation: string, err: unknown): Promise<void> {
    const srsError = new Error(
      `[SRS:SrsOfflineService] ${operation} failed: ${(err as Error)?.message ?? String(err)}`,
    );
    srsError.name = 'SrsOfflineError';
    if (err instanceof Error && err.stack) {
      srsError.stack = err.stack;
    }
    this.errorHandler.handleError(srsError);
  }

  // ---------------------------------------------------------------------------
  // Flashcard cache
  // ---------------------------------------------------------------------------

  async cacheFlashcards(flashcards: Flashcard[]): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_FLASHCARDS, 'readwrite');
      await Promise.all([
        ...flashcards.map((fc) => tx.store.put(fc)),
        tx.done,
      ]);
    } catch (e) {
      await this.reportError('cacheFlashcards', e);
    }
  }

  async getCachedFlashcards(): Promise<Flashcard[]> {
    try {
      const db = await this.getDB();
      return (await db.getAll(STORE_FLASHCARDS)) as Flashcard[];
    } catch (e) {
      await this.reportError('getCachedFlashcards', e);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Due reviews cache
  // ---------------------------------------------------------------------------

  async cacheDueReviews(reviews: Flashcard[]): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_DUE_REVIEWS, 'readwrite');
      await Promise.all([
        tx.store.clear(),
        ...reviews.map((r) => tx.store.put(r)),
        tx.done,
      ]);
    } catch (e) {
      await this.reportError('cacheDueReviews', e);
    }
  }

  async getCachedDueReviews(): Promise<Flashcard[]> {
    try {
      const db = await this.getDB();
      return (await db.getAll(STORE_DUE_REVIEWS)) as Flashcard[];
    } catch (e) {
      await this.reportError('getCachedDueReviews', e);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Offline review queue
  // ---------------------------------------------------------------------------

  async queueSrsReview(
    flashcardId: string,
    quality: number,
    newLevel: number,
  ): Promise<void> {
    try {
      const db = await this.getDB();
      await db.add(STORE_REVIEW_QUEUE, {
        flashcardId,
        quality,
        newLevel,
        timestamp: Date.now(),
      } satisfies Omit<SrsReviewQueueItem, 'id'>);
    } catch (e) {
      await this.reportError('queueSrsReview', e);
    }
  }

  async getPendingReviewCount(): Promise<number> {
    try {
      const db = await this.getDB();
      return db.count(STORE_REVIEW_QUEUE);
    } catch {
      return 0;
    }
  }

  /**
   * Syncs queued offline SRS reviews to the server.
   *
   * @param callback Invoked for each queued item. The caller should
   *   perform the HTTP request and throw on failure so the item stays
   *   in the queue.
   * @returns Summary of sync result.
   */
  async syncQueuedReviews(
    callback: (item: SrsReviewQueueItem) => Promise<void>,
  ): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;
    try {
      const db = await this.getDB();
      const all = (await db.getAll(STORE_REVIEW_QUEUE)) as SrsReviewQueueItem[];
      // Sort oldest-first so reviews are processed in submission order
      all.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

      for (const item of all) {
        try {
          await callback(item);
          await db.delete(STORE_REVIEW_QUEUE, item.id!);
          synced++;
        } catch {
          failed++;
          // Keep the item in the queue for the next sync attempt
        }
      }
    } catch (e) {
      await this.reportError('syncQueuedReviews', e);
    }
    return { synced, failed };
  }

  /**
   * Clears all offline SRS data (flashcard cache, due reviews, review queue).
   */
  async clearAll(): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(
        [STORE_FLASHCARDS, STORE_DUE_REVIEWS, STORE_REVIEW_QUEUE],
        'readwrite',
      );
      await Promise.all([
        tx.objectStore(STORE_FLASHCARDS).clear(),
        tx.objectStore(STORE_DUE_REVIEWS).clear(),
        tx.objectStore(STORE_REVIEW_QUEUE).clear(),
        tx.done,
      ]);
    } catch (e) {
      await this.reportError('clearAll', e);
    }
  }
}