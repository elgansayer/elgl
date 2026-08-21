import { Injectable, inject, signal } from '@angular/core';
import { NetworkStatusService } from './network-status.service';

const DB_NAME = 'hellotalk_reading_engine_offline';
const DB_VERSION = 1;
const STORE_ARTICLES = 'articles';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours matching ngsw cache

export interface OfflineArticle {
  id: string;
  title: string;
  content: string;
  language: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  topic: string;
  audioUrl?: string;
  wordCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class OfflineReadingEngineService {
  private readonly networkStatus = inject(NetworkStatusService);
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  readonly isOnline = this.networkStatus.isOnline;
  readonly cachedDataAvailable = signal(false);

  constructor() {
    if (typeof window !== 'undefined' && window.indexedDB) {
      this.initPromise = this.initDB();
      this.initPromise
        .then(() => this.refreshAvailability())
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
        if (!(target instanceof IDBOpenDBRequest) || !target.result) return;
        const db = target.result;
        if (!db.objectStoreNames.contains(STORE_ARTICLES)) {
          db.createObjectStore(STORE_ARTICLES, { keyPath: 'id' });
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

  private async refreshAvailability(): Promise<void> {
    try {
      await this.ensureDB();
      const articles = await this.getCachedArticles();
      this.cachedDataAvailable.set(articles.length > 0);
    } catch {
      this.cachedDataAvailable.set(false);
    }
  }

  /**
   * Cache a batch of reading articles to IndexedDB for offline access.
   * Replaces any previously cached articles to keep the store fresh.
   */
  async cacheArticles(articles: OfflineArticle[]): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    await this.clearArticles(db);
    const cachedAt = Date.now();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ARTICLES, 'readwrite');
      const store = tx.objectStore(STORE_ARTICLES);
      for (const article of articles) {
        store.put({ ...article, _cachedAt: cachedAt });
      }
      tx.oncomplete = () => {
        this.cachedDataAvailable.set(articles.length > 0);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Retrieve all cached articles that have not expired.
   */
  async getCachedArticles(): Promise<OfflineArticle[]> {
    if (!this.isAvailable()) return [];
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ARTICLES, 'readonly');
      const req = tx.objectStore(STORE_ARTICLES).getAll();
      req.onsuccess = () => {
        const raw = (req.result ?? []) as unknown[];
        const valid: OfflineArticle[] = [];
        for (const item of raw) {
          if (item && typeof item === 'object' && '_cachedAt' in item && 'id' in item) {
            const cached = item as Record<string, unknown>;
            const cachedAt = Number(cached['_cachedAt']);
            if (cachedAt && Date.now() - cachedAt < CACHE_TTL_MS) {
              valid.push({
                id: String(cached['id'] ?? ''),
                title: String(cached['title'] ?? ''),
                content: String(cached['content'] ?? ''),
                language: String(cached['language'] ?? 'en-GB'),
                difficulty: (cached['difficulty'] as OfflineArticle['difficulty']) ?? 'intermediate',
                topic: String(cached['topic'] ?? ''),
                audioUrl: cached['audioUrl'] ? String(cached['audioUrl']) : undefined,
                wordCount: Number(cached['wordCount'] ?? 0),
              });
            }
          }
        }
        resolve(valid);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get a single cached article by ID.
   */
  async getCachedArticle(id: string): Promise<OfflineArticle | null> {
    if (!this.isAvailable()) return null;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ARTICLES, 'readonly');
      const req = tx.objectStore(STORE_ARTICLES).get(id);
      req.onsuccess = () => {
        const entry = req.result;
        if (
          entry &&
          typeof entry === 'object' &&
          '_cachedAt' in entry &&
          'id' in entry &&
          'title' in entry
        ) {
          const cached = entry as Record<string, unknown>;
          const cachedAt = Number(cached['_cachedAt']);
          if (cachedAt && Date.now() - cachedAt < CACHE_TTL_MS) {
            resolve({
              id: String(cached['id'] ?? ''),
              title: String(cached['title'] ?? ''),
              content: String(cached['content'] ?? ''),
              language: String(cached['language'] ?? 'en-GB'),
              difficulty: (cached['difficulty'] as OfflineArticle['difficulty']) ?? 'intermediate',
              topic: String(cached['topic'] ?? ''),
              audioUrl: cached['audioUrl'] ? String(cached['audioUrl']) : undefined,
              wordCount: Number(cached['wordCount'] ?? 0),
            });
            return;
          }
        }
        resolve(null);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Remove all cached reading engine data.
   */
  async clearAll(): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      const db = await this.ensureDB();
      await this.clearArticles(db);
      this.cachedDataAvailable.set(false);
    } catch {
      // Silently handle clear failures
    }
  }

  private clearArticles(db: IDBDatabase): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ARTICLES, 'readwrite');
      const req = tx.objectStore(STORE_ARTICLES).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}