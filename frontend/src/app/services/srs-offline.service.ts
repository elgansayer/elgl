import { Injectable, signal } from '@angular/core';
import type { Flashcard } from './vocabulary.store';

interface QueuedReviewPayload {
  flashcardId: string;
  quality: number;
  newLevel: number;
  timestamp: string;
}

const DB_NAME = 'hellotalk_srs_offline';
const DB_VERSION = 1;

@Injectable({
  providedIn: 'root',
})
export class SrsOfflineService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  readonly pendingSyncCount = signal(0);

  constructor() {
    if (typeof window !== 'undefined' && window.indexedDB) {
      this.initPromise = this.initDB();
      this.initPromise
        .then(() => this.refreshPendingCount())
        .catch(() => undefined);
    }
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const target = event.target;
        if (!target || typeof target !== 'object' || !('result' in target)) return;
        const db = target.result as IDBDatabase;
        if (!db.objectStoreNames.contains('flashcards')) {
          db.createObjectStore('flashcards', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('due_reviews')) {
          db.createObjectStore('due_reviews', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id' });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (this.initPromise) await this.initPromise;
    if (!this.db) throw new Error('IndexedDB not initialised');
    return this.db;
  }

  private isAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.indexedDB;
  }

  /** Cache flashcards locally for offline access */
  async cacheFlashcards(list: Flashcard[]): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    await this.clearStore(db, 'flashcards');
    const store = db.transaction('flashcards', 'readwrite').objectStore('flashcards');
    for (const item of list) {
      await this.putInStore(store, item as Record<string, unknown>);
    }
  }

  /** Retrieve cached flashcards when offline */
  async getCachedFlashcards(): Promise<Flashcard[]> {
    if (!this.isAvailable()) return [];
    const db = await this.ensureDB();
    return this.getAllFromStore(db, 'flashcards');
  }

  /** Cache due reviews for offline access */
  async cacheDueReviews(list: Flashcard[]): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    await this.clearStore(db, 'due_reviews');
    const store = db.transaction('due_reviews', 'readwrite').objectStore('due_reviews');
    for (const item of list) {
      await this.putInStore(store, item as Record<string, unknown>);
    }
  }

  /** Retrieve cached due reviews when offline */
  async getCachedDueReviews(): Promise<Flashcard[]> {
    if (!this.isAvailable()) return [];
    const db = await this.ensureDB();
    return this.getAllFromStore(db, 'due_reviews');
  }

  /** Queue an SRS review operation for later sync when offline */
  async queueSrsReview(flashcardId: string, quality: number, newLevel: number): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    const id = `srs_review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payload: QueuedReviewPayload & { id: string } = {
      id,
      flashcardId,
      quality,
      newLevel,
      timestamp: new Date().toISOString(),
    };
    const store = db.transaction('sync_queue', 'readwrite').objectStore('sync_queue');
    await this.putInStore(store, payload as unknown as Record<string, unknown>);
    await this.refreshPendingCount();
  }

  /** Sync queued offline reviews to the backend */
  async syncQueuedReviews(
    syncCallback: (queued: QueuedReviewPayload) => Promise<void>,
  ): Promise<{ synced: number; failed: number }> {
    if (!this.isAvailable()) return { synced: 0, failed: 0 };
    const db = await this.ensureDB();
    const items = await this.getAllFromStore(db, 'sync_queue');
    if (items.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;

    for (const item of items) {
      const queued = item as unknown as QueuedReviewPayload & { id: string };
      try {
        await syncCallback(queued);
        await this.deleteFromStore(db, 'sync_queue', queued.id);
        synced++;
      } catch {
        failed++;
      }
    }

    await this.refreshPendingCount();
    return { synced, failed };
  }

  private async refreshPendingCount(): Promise<void> {
    try {
      const db = await this.ensureDB();
      const items = await this.getAllFromStore(db, 'sync_queue');
      this.pendingSyncCount.set(items.length);
    } catch {
      // silently ignore
    }
  }

  // --- IDB Helpers ---

  private putInStore(store: IDBObjectStore, value: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = store.put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private getAllFromStore(db: IDBDatabase, storeName: string): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
      const store = db.transaction(storeName, 'readonly').objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  private deleteFromStore(db: IDBDatabase, storeName: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = db.transaction(storeName, 'readwrite').objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private clearStore(db: IDBDatabase, storeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = db.transaction(storeName, 'readwrite').objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}
