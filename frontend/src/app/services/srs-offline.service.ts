import { Injectable } from '@angular/core';
import type { Flashcard } from './vocabulary.store';

interface SrsReviewQueueItem {
  id?: number;
  flashcardId: string;
  quality: number;
  newLevel: number;
  timestamp: number;
}

const DB_NAME = 'srs-offline-db';
const DB_VERSION = 1;
const FLASHCARDS_STORE = 'flashcards';
const DUE_REVIEWS_STORE = 'due-reviews';
const REVIEW_QUEUE_STORE = 'review-queue';

@Injectable({ providedIn: 'root' })
export class SrsOfflineService {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<IDBDatabase>;

  constructor() {
    this.dbReady = this.openDatabase();
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(FLASHCARDS_STORE)) {
          db.createObjectStore(FLASHCARDS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(DUE_REVIEWS_STORE)) {
          db.createObjectStore(DUE_REVIEWS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(REVIEW_QUEUE_STORE)) {
          db.createObjectStore(REVIEW_QUEUE_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
        }
      };
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };
      request.onerror = (event) => {
        console.error(
          'Failed to open IndexedDB for SRS offline storage',
          (event.target as IDBOpenDBRequest).error,
        );
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  private async getDb(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return this.dbReady;
  }

  private async putAll(storeName: string, items: Flashcard[]): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      // Clear existing entries then add all
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        let remaining = items.length;
        if (remaining === 0) {
          resolve();
          return;
        }
        for (const item of items) {
          const addReq = store.add(item);
          addReq.onsuccess = () => {
            remaining--;
            if (remaining === 0) resolve();
          };
          addReq.onerror = () => reject(addReq.error);
        }
      };
      clearReq.onerror = () => reject(clearReq.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  private async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  }

  async cacheFlashcards(list: Flashcard[]): Promise<void> {
    try {
      await this.putAll(FLASHCARDS_STORE, list);
    } catch (error) {
      console.warn(
        'Failed to cache flashcards in IndexedDB',
        (error as Error).message,
      );
    }
  }

  async getCachedFlashcards(): Promise<Flashcard[]> {
    try {
      return await this.getAll<Flashcard>(FLASHCARDS_STORE);
    } catch {
      return [];
    }
  }

  async cacheDueReviews(list: Flashcard[]): Promise<void> {
    try {
      await this.putAll(DUE_REVIEWS_STORE, list);
    } catch (error) {
      console.warn(
        'Failed to cache due reviews in IndexedDB',
        (error as Error).message,
      );
    }
  }

  async getCachedDueReviews(): Promise<Flashcard[]> {
    try {
      return await this.getAll<Flashcard>(DUE_REVIEWS_STORE);
    } catch {
      return [];
    }
  }

  async queueSrsReview(
    flashcardId: string,
    quality: number,
    newLevel: number,
  ): Promise<void> {
    try {
      const db = await this.getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(REVIEW_QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(REVIEW_QUEUE_STORE);
        const item: SrsReviewQueueItem = {
          flashcardId,
          quality,
          newLevel,
          timestamp: Date.now(),
        };
        const req = store.add(item);
        req.onsuccess = () => resolve();
        req.onerror = () => {
          console.warn(
            'Failed to queue SRS review in IndexedDB',
            req.error?.message,
          );
          resolve(); // resolve anyway, don't block on queue failure
        };
      });
    } catch (error) {
      console.warn(
        'Failed to queue SRS review',
        (error as Error).message,
      );
    }
  }

  async syncQueuedReviews(
    processor: (item: SrsReviewQueueItem) => Promise<void>,
  ): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    try {
      const db = await this.getDb();
      const items = await this.getAll<SrsReviewQueueItem>(REVIEW_QUEUE_STORE);

      for (const item of items) {
        if (!item.id) continue;
        try {
          await processor(item);
          // Remove from queue on success
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(REVIEW_QUEUE_STORE, 'readwrite');
            const store = tx.objectStore(REVIEW_QUEUE_STORE);
            const delReq = store.delete(item.id!);
            delReq.onsuccess = () => resolve();
            delReq.onerror = () => reject(delReq.error);
          });
          synced++;
        } catch {
          failed++;
          console.warn(
            `Failed to sync queued SRS review for flashcard ${item.flashcardId}`,
          );
        }
      }
    } catch (error) {
      console.error(
        'Failed to sync review queue',
        (error as Error).message,
      );
    }

    return { synced, failed };
  }

  async clearAll(): Promise<void> {
    try {
      const db = await this.getDb();
      for (const storeName of [
        FLASHCARDS_STORE,
        DUE_REVIEWS_STORE,
        REVIEW_QUEUE_STORE,
      ]) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(storeName, 'readwrite');
          const objStore = tx.objectStore(storeName);
          const req = objStore.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }
    } catch (error) {
      console.warn(
        'Failed to clear SRS offline storage',
        (error as Error).message,
      );
    }
  }
}
