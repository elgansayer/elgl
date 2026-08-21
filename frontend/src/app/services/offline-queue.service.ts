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

  /** Reactive count of queued messages for UI indicators */
  readonly queuedCount = signal(0);
  readonly queueSize = this.queuedCount;

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
        if (!(target instanceof IDBOpenDBRequest) || !target.result) {
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
    if (this.initPromise) {
      await this.initPromise;
    }
    if (!this.db) {
      throw new Error('IndexedDB not initialised');
    }
  }

  private async refreshCount(): Promise<void> {
    try {
      const messages = await this.getQueuedMessages();
      this.queuedCount.set(messages.length);
    } catch {
      // Silently handle count refresh failures
    }
  }

  private isIndexedDBAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.indexedDB;
  }

  async enqueueMessage(message: ChatMessage): Promise<void> {
    if (!this.isIndexedDBAvailable()) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(message);
      request.onsuccess = () => {
        this.queuedCount.update((c) => c + 1);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getQueuedMessages(): Promise<ChatMessage[]> {
    if (!this.isIndexedDBAvailable()) return [];
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
    if (!this.isIndexedDBAvailable()) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);
      request.onsuccess = () => {
        this.queuedCount.update((c) => Math.max(0, c - 1));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /** Remove all queued messages and reset the counter. */
  async clearQueue(): Promise<void> {
    if (!this.isIndexedDBAvailable()) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      request.onsuccess = () => {
        this.queuedCount.set(0);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
}
