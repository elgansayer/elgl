import { Injectable, signal, inject } from '@angular/core';
import { Flashcard } from './vocabulary.store';
import { NetworkStatusService } from './network-status.service';

/** A queued SRS review recording the user's response while offline. */
export interface QueuedSrsReview {
  flashcardId: string;
  quality: number;
  newLevel: number;
  queuedAt: number; // Date.now()
}

/** Minimal indexed summary of a synced review result. */
export interface SyncResult {
  synced: number;
  failed: number;
}

@Injectable({
  providedIn: 'root',
})
export class SrsOfflineService {
  private readonly networkStatus = inject(NetworkStatusService);

  private readonly dbName = 'srs_offline_db';
  private readonly flashcardsStoreName = 'flashcards';
  private readonly dueStoreName = 'due_reviews';
  private readonly reviewQueueStoreName = 'review_queue';
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /** Number of pending offline SRS reviews waiting to sync. */
  readonly pendingReviewCount = signal(0);

  constructor() {
    if (typeof window !== 'undefined' && window.indexedDB) {
      this.initPromise = this.initDB();
      this.initPromise
        .then(() => this.refreshPendingCount())
        .catch(() => undefined);
    }
  }

  // ---------- IndexedDB lifecycle ----------

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
        if (!db.objectStoreNames.contains(this.flashcardsStoreName)) {
          db.createObjectStore(this.flashcardsStoreName, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.dueStoreName)) {
          db.createObjectStore(this.dueStoreName, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.reviewQueueStoreName)) {
          const queueStore = db.createObjectStore(this.reviewQueueStoreName, {
            keyPath: 'flashcardId',
          });
          queueStore.createIndex('queuedAt', 'queuedAt', { unique: false });
        }
      };
    });
  }

  private async ensureDB(): Promise<void> {
    if (!this.initPromise) {
      if (this.db) return;
      throw new Error('SRS IndexedDB not available');
    }
    await this.initPromise;
    if (!this.db) throw new Error('SRS IndexedDB not initialised');
  }

  private isAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.indexedDB;
  }

  // ---------- Flashcard cache ----------

  async cacheFlashcards(cards: Flashcard[]): Promise<void> {
    if (!this.isAvailable()) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.flashcardsStoreName, 'readwrite');
      const store = tx.objectStore(this.flashcardsStoreName);
      store.clear();
      cards.forEach((card) => store.put(card));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedFlashcards(): Promise<Flashcard[]> {
    if (!this.isAvailable()) return [];
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.flashcardsStoreName, 'readonly');
      const store = tx.objectStore(this.flashcardsStoreName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
  }

  // ---------- Due reviews cache ----------

  async cacheDueReviews(cards: Flashcard[]): Promise<void> {
    if (!this.isAvailable()) return;
    await this.ensureDB();
    const tx = this.db!.transaction(this.dueStoreName, 'readwrite');
    const store = tx.objectStore(this.dueStoreName);
    store.clear();
    cards.forEach((card) => store.put(card));
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedDueReviews(): Promise<Flashcard[]> {
    if (!this.isAvailable()) return [];
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.dueStoreName, 'readonly');
      const store = tx.objectStore(this.dueStoreName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
  }

  // ---------- Offline review queue ----------

  async queueSrsReview(
    flashcardId: string,
    quality: number,
    newLevel: number,
  ): Promise<void> {
    if (!this.isAvailable()) return;
    await this.ensureDB();

    // For accurate counting, refresh count first in its own transaction
    // so we can detect upserts without read-write contention.
    const existing = await new Promise<QueuedSrsReview[]>((resolve, reject) => {
      const tx = this.db!.transaction(this.reviewQueueStoreName, 'readonly');
      const store = tx.objectStore(this.reviewQueueStoreName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
    const isNew = !existing.some((r) => r.flashcardId === flashcardId);

    const entry: QueuedSrsReview = {
      flashcardId,
      quality,
      newLevel,
      queuedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.reviewQueueStoreName, 'readwrite');
      const store = tx.objectStore(this.reviewQueueStoreName);
      const request = store.put(entry);
      request.onsuccess = () => {
        if (isNew) {
          this.pendingReviewCount.update((c) => c + 1);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getQueuedReviews(): Promise<QueuedSrsReview[]> {
    if (!this.isAvailable()) return [];
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.reviewQueueStoreName, 'readonly');
      const store = tx.objectStore(this.reviewQueueStoreName);
      const index = store.index('queuedAt');
      const request = index.getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
  }

  async removeQueuedReview(flashcardId: string): Promise<void> {
    if (!this.isAvailable()) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.reviewQueueStoreName, 'readwrite');
      const store = tx.objectStore(this.reviewQueueStoreName);
      const request = store.delete(flashcardId);
      request.onsuccess = () => {
        this.pendingReviewCount.update((c) => Math.max(0, c - 1));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllQueuedReviews(): Promise<void> {
    if (!this.isAvailable()) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.reviewQueueStoreName, 'readwrite');
      const store = tx.objectStore(this.reviewQueueStoreName);
      const request = store.clear();
      request.onsuccess = () => {
        this.pendingReviewCount.set(0);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ---------- Sync ----------

  /**
   * Attempts to sync all queued offline reviews. Each queued entry is sent via
   * the provided `sendReview` callback. On success the entry is removed; on
   * failure it stays in the queue so a future sync can retry it.
   */
  async syncQueuedReviews(
    sendReview: (queued: QueuedSrsReview) => Promise<void>,
  ): Promise<SyncResult> {
    const queued = await this.getQueuedReviews();
    if (queued.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;

    for (const entry of queued) {
      try {
        await sendReview(entry);
        await this.removeQueuedReview(entry.flashcardId);
        synced++;
      } catch {
        failed++;
      }
    }

    await this.refreshPendingCount();
    return { synced, failed };
  }

  // ---------- Helpers ----------

  private async refreshPendingCount(): Promise<void> {
    try {
      const queued = await this.getQueuedReviews();
      this.pendingReviewCount.set(queued.length);
    } catch {
      // Silently handle count refresh errors
    }
  }
}