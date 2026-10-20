import { Injectable, inject, signal } from '@angular/core';
import { NetworkStatusService } from './network-status.service';

const DB_NAME = 'hellotalk_reading_offline';
const DB_VERSION = 1;
const STORE_ARTICLES = 'articles';
const STORE_HISTORY = 'reading_history';
const MAX_CACHED_ARTICLES = 50;

interface CachedArticle {
  id: string;
  title: string;
  content: string;
  language: string;
  difficulty: string;
  topic: string;
  audioUrl?: string;
  wordCount: number;
  cachedAt: number;
}

interface ReadingHistoryEntry {
  articleId: string;
  title: string;
  difficulty: string;
  topic: string;
  readAt: number;
}

@Injectable({
  providedIn: 'root',
})
export class OfflineReadingService {
  private readonly networkStatus = inject(NetworkStatusService);
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  readonly isOfflineMode = signal(false);

  constructor() {
    if (typeof window !== 'undefined' && window.indexedDB) {
      this.initPromise = this.initDB();
      this.syncOnlineStatus();
    }
  }

  private syncOnlineStatus(): void {
    const handleStatusChange = (): void => {
      const online = this.networkStatus.isOnline();
      this.isOfflineMode.set(!online);
    };
    handleStatusChange();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleStatusChange);
      window.addEventListener('offline', handleStatusChange);
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
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_ARTICLES)) {
          db.createObjectStore(STORE_ARTICLES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_HISTORY)) {
          db.createObjectStore(STORE_HISTORY, { keyPath: 'id', autoIncrement: true });
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

  /** Cache articles locally for offline access */
  async cacheArticles(articles: CachedArticle[]): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    const store = db.transaction(STORE_ARTICLES, 'readwrite').objectStore(STORE_ARTICLES);

    // ⚡ Bolt Optimization: Replace sequential awaits with Promise.all mapped concurrent operations
    await Promise.all(
      articles.map((article) => {
        const cached: CachedArticle = { ...article, cachedAt: Date.now() };
        return this.putInStore(store, cached as unknown as Record<string, unknown>);
      }),
    );

    // Evict old articles if exceeding max
    const allArticles = await this.getAllFromStore(db, STORE_ARTICLES);
    if (allArticles.length > MAX_CACHED_ARTICLES) {
      const sorted = (allArticles as CachedArticle[]).sort((a, b) => a.cachedAt - b.cachedAt);
      const toRemove = sorted.slice(0, sorted.length - MAX_CACHED_ARTICLES);
      const evictStore = db.transaction(STORE_ARTICLES, 'readwrite').objectStore(STORE_ARTICLES);
      await Promise.all(
        toRemove.map((item) => this.deleteFromStore(evictStore, item.id)),
      );
    }
  }

  /** Retrieve cached articles when offline */
  async getCachedArticles(): Promise<CachedArticle[]> {
    if (!this.isAvailable()) return [];
    const db = await this.ensureDB();
    const articles = await this.getAllFromStore(db, STORE_ARTICLES);
    return (articles as CachedArticle[]).sort((a, b) => b.cachedAt - a.cachedAt);
  }

  /** Record an article view in reading history */
  async recordReadingHistory(
    articleId: string,
    title: string,
    difficulty: string,
    topic: string,
  ): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    const store = db.transaction(STORE_HISTORY, 'readwrite').objectStore(STORE_HISTORY);
    const entry: ReadingHistoryEntry = {
      articleId,
      title,
      difficulty,
      topic,
      readAt: Date.now(),
    };
    await this.putInStore(store, entry as unknown as Record<string, unknown>);
  }

  /** Retrieve reading history from local storage */
  async getReadingHistory(): Promise<ReadingHistoryEntry[]> {
    if (!this.isAvailable()) return [];
    const db = await this.ensureDB();
    const entries = await this.getAllFromStore(db, STORE_HISTORY);
    return (entries as ReadingHistoryEntry[]).sort((a, b) => b.readAt - a.readAt).slice(0, 50);
  }

  /** Clear all cached reading data */
  async clearAll(): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    await Promise.all([
      this.clearStore(db, STORE_ARTICLES),
      this.clearStore(db, STORE_HISTORY),
    ]);
    this.isOfflineMode.set(false);
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

  private deleteFromStore(store: IDBObjectStore, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
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
