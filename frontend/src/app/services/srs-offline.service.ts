import { Injectable, inject, signal } from '@angular/core';
import { Flashcard } from './vocabulary.store';

interface QueuedReview {
  flashcardId: string;
  quality: number;
  newLevel: number;
  timestamp: string;
}

interface OfflinePayload {
  flashcards: Flashcard[];
  dueReviews: Flashcard[];
  queuedReviews: QueuedReview[];
}

@Injectable({
  providedIn: 'root',
})
export class SrsOfflineService {
  private readonly dbName = 'hellotalk_srs_offline';
  private readonly storeName = 'srs_cache';

  /** Number of SRS reviews queued for sync */
  readonly pendingSyncCount = signal(0);
  /** Whether a sync operation is currently in progress */
  readonly isSyncing = signal(false);

  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.indexedDB) {
      this.initPromise = this.initDB();
      this.initPromise.then(() => this.refreshCount()).catch(() => undefined);
    }
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const target = event.target;
        if (!(target instanceof IDBOpenDBRequest)) return;
        const db = target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
    });
  }

  private async ensureDB(): Promise<void> {
    if (this.initPromise) await this.initPromise;
    if (!this.db) throw new Error('SRS offline IndexedDB not initialised');
  }

  private isIndexedDBAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.indexedDB;
  }

  private async readPayload(): Promise<OfflinePayload> {
    if (!this.isIndexedDBAvailable()) return { flashcards: [], dueReviews: [], queuedReviews: [] };
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.get('cache');
      req.onsuccess = () => {
        const raw = req.result;
        if (raw && typeof raw === 'object' && 'payload' in raw) {
          resolve(raw.payload as OfflinePayload);
        } else {
          resolve({ flashcards: [], dueReviews: [], queuedReviews: [] });
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  private async writePayload(payload: OfflinePayload): Promise<void> {
    if (!this.isIndexedDBAvailable()) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.put({ key: 'cache', payload });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async refreshCount(): Promise<void> {
    try {
      const payload = await this.readPayload();
      this.pendingSyncCount.set(payload.queuedReviews.length);
    } catch {
      // Silently handle count refresh failures
    }
  }

  /** Cache flashcards locally for offline access. */
  async cacheFlashcards(flashcards: Flashcard[]): Promise<void> {
    const current = await this.readPayload();
    current.flashcards = flashcards;
    await this.writePayload(current);
  }

  /** Cache due reviews locally for offline access. */
  async cacheDueReviews(reviews: Flashcard[]): Promise<void> {
    const current = await this.readPayload();
    current.dueReviews = reviews;
    await this.writePayload(current);
  }

  /** Retrieve cached flashcards from local storage. */
  async getCachedFlashcards(): Promise<Flashcard[]> {
    const payload = await this.readPayload();
    return payload.flashcards;
  }

  /** Retrieve cached due reviews from local storage. */
  async getCachedDueReviews(): Promise<Flashcard[]> {
    const payload = await this.readPayload();
    return payload.dueReviews;
  }

  /**
   * Queue an SRS review grade for later sync when offline.
   * Updates the cached dueReviews list optimistically.
   */
  async queueSrsReview(flashcardId: string, quality: number, newLevel: number): Promise<void> {
    const current = await this.readPayload();
    current.queuedReviews.push({
      flashcardId,
      quality,
      newLevel,
      timestamp: new Date().toISOString(),
    });
    // Remove from cached due reviews if present
    current.dueReviews = current.dueReviews.filter((f) => f.id !== flashcardId);
    // Update the cached flashcard with the new level
    current.flashcards = current.flashcards.map((f) =>
      f.id === flashcardId ? { ...f, srs_level: newLevel } : f,
    );
    await this.writePayload(current);
    this.pendingSyncCount.set(current.queuedReviews.length);
  }

  /** Get all queued pending reviews. */
  async getPendingReviews(): Promise<QueuedReview[]> {
    const payload = await this.readPayload();
    return payload.queuedReviews;
  }

  /**
   * Sync queued reviews using the provided function.
   * Individual failures do not block the rest.
   */
  async syncQueuedReviews(
    syncFn: (queued: QueuedReview) => Promise<void>,
  ): Promise<{ synced: number; failed: number }> {
    this.isSyncing.set(true);
    let synced = 0;
    let failed = 0;
    try {
      const payload = await this.readPayload();
      const remaining: QueuedReview[] = [];
      for (const review of payload.queuedReviews) {
        try {
          await syncFn(review);
          synced++;
        } catch {
          remaining.push(review);
          failed++;
        }
      }
      payload.queuedReviews = remaining;
      await this.writePayload(payload);
      this.pendingSyncCount.set(remaining.length);
    } catch (err: unknown) {
      // overall sync failure - leave queue intact
    } finally {
      this.isSyncing.set(false);
    }
    return { synced, failed };
  }

  /** Remove a successfully synced review from the queue. */
  async removePendingReview(flashcardId: string): Promise<void> {
    const current = await this.readPayload();
    current.queuedReviews = current.queuedReviews.filter(
      (r) => r.flashcardId !== flashcardId,
    );
    await this.writePayload(current);
    this.pendingSyncCount.set(current.queuedReviews.length);
  }

  /** Clear all offline cached data. */
  async clearCache(): Promise<void> {
    if (!this.isIndexedDBAvailable()) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.clear();
      tx.oncomplete = () => {
        this.pendingSyncCount.set(0);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }
}