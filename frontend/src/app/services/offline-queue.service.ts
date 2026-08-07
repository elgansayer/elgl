import { Injectable, signal } from '@angular/core';
import { ChatMessage } from './chat.service';

@Injectable({
  providedIn: 'root',
})
export class OfflineQueueService {
  private readonly dbName = 'chat_offline_db';
  private readonly storeName = 'messages';
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /** Reactive count of queued messages pending sync. */
  readonly queueSize = signal<number>(0);

  constructor() {
    if (typeof window !== 'undefined' && window.indexedDB) {
      this.initPromise = this.initDB().then(() => this.refreshCount());
    }
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 2);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const target = event.target;
        if (!(target instanceof IDBOpenDBRequest)) {
          return;
        }
        const db = target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });
  }

  private async ensureDB(): Promise<void> {
    if (!this.db && this.initPromise) {
      await this.initPromise;
    }
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }
  }

  private async refreshCount(): Promise<void> {
    try {
      const messages = await this.getQueuedMessages();
      this.queueSize.set(messages.length);
    } catch {
      this.queueSize.set(0);
    }
  }

  async enqueueMessage(message: ChatMessage): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(message);
      request.onsuccess = () => {
        this.queueSize.update((n) => n + 1);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getQueuedMessages(): Promise<ChatMessage[]> {
    if (typeof window === 'undefined' || !window.indexedDB) return [];
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async removeMessage(id: string): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);
      request.onsuccess = () => {
        this.queueSize.update((n) => Math.max(0, n - 1));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      request.onsuccess = () => {
        this.queueSize.set(0);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
}
