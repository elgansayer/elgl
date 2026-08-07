import { Injectable, signal } from '@angular/core';
import { Flashcard } from './vocabulary.store';

interface QueuedSrsReview {
  flashcardId: string;
  quality: number;
  newLevel: number;
  queuedAt: string;
}

const DB_NAME = 'hellotalk_srs';
const FLASHCARD_STORE = 'flashcards';
const DUE_REVIEW_STORE = 'due_reviews';
const REVIEW_QUEUE_STORE = 'review_queue';

@Injectable({
  providedIn: 'root',
})
export class SrsOfflineService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  readonly queuedReviewCount = signal(0);

  constructor() {
    if (this.isIndexedDBAvailable()) {
      this.initPromise = this.initDB();
      this.initPromise.then(() => this.refreshQueueCount()).catch(() => undefined);
    }
  }

  private isIndexedDBAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.indexedDB;
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (!this.db) {
      throw new Error('SRS IndexedDB not initialised');
    }
    return this.db;
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const target = event.target as IDBOpenDBRequest | null;
        if (!target || typeof target.result !== 'object' || !target.result) return;
        const db = target.result;

        if (!db.objectStoreNames.contains(FLASHCARD_STORE)) {
          db.createObjectStore(FLASHCARD_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(DUE_REVIEW_STORE)) {
          db.createObjectStore(DUE_REVIEW_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(REVIEW_QUEUE_STORE)) {
          const queueStore = db.createObjectStore(REVIEW_QUEUE_STORE, {
            keyPath: 'flashcardId',
          });
          queueStore.createIndex('queuedAt', 'queuedAt', { unique: false });
        }
      };
    });
  }

  // -- Flashcard caching --

  async cacheFlashcards(list: Flashcard[]): Promise<void> {
    if (!this.isIndexedDBAvailable() || list.length === 0) return;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(FLASHCARD_STORE, 'readwrite');
      const store = transaction.objectStore(FLASHCARD_STORE);
      // Clear then repopulate
      store.clear();
      list.forEach((fc) => store.put(fc));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getCachedFlashcards(): Promise<Flashcard[]> {
    if (!this.isIndexedDBAvailable()) return [];
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(FLASHCARD_STORE, 'readonly');
      const store = transaction.objectStore(FLASHCARD_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // -- Due reviews caching --

  async cacheDueReviews(list: Flashcard[]): Promise<void> {
    if (!this.isIndexedDBAvailable() || list.length === 0) return;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DUE_REVIEW_STORE, 'readwrite');
      const store = transaction.objectStore(DUE_REVIEW_STORE);
      store.clear();
      list.forEach((fc) => store.put(fc));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getCachedDueReviews(): Promise<Flashcard[]> {
    if (!this.isIndexedDBAvailable()) return [];
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DUE_REVIEW_STORE, 'readonly');
      const store = transaction.objectStore(DUE_REVIEW_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // -- Offline review queue --

  async queueSrsReview(
    flashcardId: string,
    quality: number,
    newLevel: number,
  ): Promise<void> {
    if (!this.isIndexedDBAvailable()) return;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(REVIEW_QUEUE_STORE, 'readwrite');
      const store = transaction.objectStore(REVIEW_QUEUE_STORE);
      const entry: QueuedSrsReview = {
        flashcardId,
        quality,
        newLevel,
        queuedAt: new Date().toISOString(),
      };
      const request = store.put(entry);
      request.onsuccess = () => {
        this.queuedReviewCount.update((c) => c + 1);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async syncQueuedReviews(
    syncFn: (queued: QueuedSrsReview) => Promise<void>,
  ): Promise<{ synced: number; failed: number }> {
    if (!this.isIndexedDBAvailable()) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;
    const db = await this.ensureDB();

    const entries = await new Promise<QueuedSrsReview[]>((resolve, reject) => {
      const transaction = db.transaction(REVIEW_QUEUE_STORE, 'readonly');
      const store = transaction.objectStore(REVIEW_QUEUE_STORE);
      const index = store.index('queuedAt');
      const request = index.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    if (entries.length === 0) return { synced: 0, failed: 0 };

    for (const entry of entries) {
      try {
        await syncFn(entry);
        // Remove from queue on success
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(REVIEW_QUEUE_STORE, 'readwrite');
          const store = tx.objectStore(REVIEW_QUEUE_STORE);
          store.delete(entry.flashcardId);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        synced++;
      } catch {
        failed++;
      }
    }

    this.queuedReviewCount.update((c) => Math.max(0, c - synced));
    return { synced, failed };
  }

  private async refreshQueueCount(): Promise<void> {
    try {
      const db = await this.ensureDB();
      const count = await new Promise<number>((resolve, reject) => {
        const transaction = db.transaction(REVIEW_QUEUE_STORE, 'readonly');
        const store = transaction.objectStore(REVIEW_QUEUE_STORE);
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      this.queuedReviewCount.set(count);
    } catch {
      // Silently handle
    }
  }
}