import { Injectable, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import type { ChatMessage } from './chat.service';

interface QueuedChatMessage extends ChatMessage {
  owner_id: string;
  queued_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class OfflineQueueService {
  private readonly dbName = 'chat_offline_db';
  private readonly storeName = 'messages';
  private readonly ownerIndexName = 'owner_id';
  private readonly dbVersion = 2;
  private readonly maxQueuedMessages = 200;
  private readonly maxQueueAgeMs = 7 * 24 * 60 * 60 * 1000;

  private readonly authService = inject(AuthService);
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private activeOwnerId: string | null = null;

  /** Reactive count of queued messages for the currently authenticated account. */
  readonly queuedCount = signal(0);
  readonly queueSize = this.queuedCount;

  constructor() {
    if (this.isIndexedDBAvailable()) {
      this.initPromise = this.initDB();
    }

    effect(() => {
      const ownerId = this.authService.currentUser()?.id ?? null;
      this.activeOwnerId = ownerId;

      if (!ownerId) {
        this.queuedCount.set(0);
        return;
      }

      void this.refreshCount(ownerId);
    });
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(this.dbName, this.dbVersion);
      request.onerror = () => reject(new Error('Offline queue database could not be opened'));
      request.onblocked = () => reject(new Error('Offline queue database upgrade is blocked'));
      request.onsuccess = () => {
        this.db = request.result;
        this.db.onversionchange = () => {
          this.db?.close();
          this.db = null;
        };
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = request.result;
        let store: IDBObjectStore;

        if (!db.objectStoreNames.contains(this.storeName)) {
          store = db.createObjectStore(this.storeName, { keyPath: 'id' });
        } else {
          store = request.transaction!.objectStore(this.storeName);

          // Version 1 stored messages without an account owner. That data cannot be
          // safely attributed after an account switch, so fail closed and discard it.
          if (event.oldVersion < 2) {
            store.clear();
          }
        }

        if (!store.indexNames.contains(this.ownerIndexName)) {
          store.createIndex(this.ownerIndexName, this.ownerIndexName, { unique: false });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.isIndexedDBAvailable()) {
      throw new Error('Offline message storage is unavailable');
    }

    if (this.initPromise) {
      await this.initPromise;
    }

    if (!this.db) {
      throw new Error('Offline message storage is unavailable');
    }

    return this.db;
  }

  private currentOwnerId(): string | null {
    const ownerId = this.authService.currentUser()?.id?.trim();
    return ownerId || null;
  }

  private isIndexedDBAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.indexedDB;
  }

  private assertQueueableMessage(message: ChatMessage, ownerId: string): void {
    if (!message.id?.trim() || !message.room_id?.trim()) {
      throw new Error('Offline message is missing required identifiers');
    }
    if (message.sender_id !== ownerId) {
      throw new Error('Offline message does not belong to the authenticated account');
    }
    if (!Number.isFinite(Date.parse(message.created_at))) {
      throw new Error('Offline message has an invalid creation timestamp');
    }
  }

  private async refreshCount(ownerId: string): Promise<void> {
    try {
      await this.pruneExpired(ownerId);
      const db = await this.ensureDB();
      const count = await new Promise<number>((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readonly');
        const index = transaction.objectStore(this.storeName).index(this.ownerIndexName);
        const request = index.count(ownerId);
        request.onsuccess = () => resolve(Math.min(request.result, this.maxQueuedMessages));
        request.onerror = () => reject(new Error('Offline queue count failed'));
      });

      if (this.activeOwnerId === ownerId) {
        this.queuedCount.set(count);
      }
    } catch {
      if (this.activeOwnerId === ownerId) {
        this.queuedCount.set(0);
      }
    }
  }

  private async pruneExpired(ownerId: string): Promise<void> {
    const db = await this.ensureDB();
    const cutoff = Date.now() - this.maxQueueAgeMs;

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const index = transaction.objectStore(this.storeName).index(this.ownerIndexName);
      const request = index.openCursor(ownerId);

      request.onerror = () => reject(new Error('Offline queue retention cleanup failed'));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;

        const record = cursor.value as Partial<QueuedChatMessage>;
        const queuedAt = typeof record.queued_at === 'string' ? Date.parse(record.queued_at) : NaN;
        if (!Number.isFinite(queuedAt) || queuedAt < cutoff) {
          cursor.delete();
        }
        cursor.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Offline queue retention cleanup failed'));
      transaction.onabort = () => reject(new Error('Offline queue retention cleanup failed'));
    });
  }

  async enqueueMessage(message: ChatMessage): Promise<void> {
    const ownerId = this.currentOwnerId();
    if (!ownerId) {
      throw new Error('Sign in before queueing an offline message');
    }

    this.assertQueueableMessage(message, ownerId);
    const db = await this.ensureDB();
    const record: QueuedChatMessage = {
      ...message,
      owner_id: ownerId,
      queued_at: new Date().toISOString(),
    };

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const ownerIndex = store.index(this.ownerIndexName);
      const existingRequest = store.get(record.id);
      let rejectedForCapacity = false;
      let rejectedForOwnership = false;

      existingRequest.onerror = () => reject(new Error('Offline queue idempotency check failed'));
      existingRequest.onsuccess = () => {
        const existing = existingRequest.result as QueuedChatMessage | undefined;
        if (existing) {
          if (existing.owner_id !== ownerId) {
            rejectedForOwnership = true;
            transaction.abort();
            return;
          }
          store.put(record);
          return;
        }

        const countRequest = ownerIndex.count(ownerId);
        countRequest.onerror = () => reject(new Error('Offline queue capacity check failed'));
        countRequest.onsuccess = () => {
          if (countRequest.result >= this.maxQueuedMessages) {
            rejectedForCapacity = true;
            transaction.abort();
            return;
          }
          store.put(record);
        };
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Offline message could not be queued'));
      transaction.onabort = () =>
        reject(
          new Error(
            rejectedForCapacity
              ? `Offline queue is full (${this.maxQueuedMessages} messages)`
              : rejectedForOwnership
                ? 'Offline queue item belongs to a different account'
                : 'Offline message could not be queued',
          ),
        );
    });

    await this.refreshCount(ownerId);
  }

  async getQueuedMessages(): Promise<ChatMessage[]> {
    const ownerId = this.currentOwnerId();
    if (!ownerId || !this.isIndexedDBAvailable()) return [];

    await this.pruneExpired(ownerId);
    const db = await this.ensureDB();
    const records = await new Promise<QueuedChatMessage[]>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const index = transaction.objectStore(this.storeName).index(this.ownerIndexName);
      const request = index.getAll(ownerId, this.maxQueuedMessages);
      request.onsuccess = () => resolve((request.result ?? []) as QueuedChatMessage[]);
      request.onerror = () => reject(new Error('Offline queue could not be read'));
    });

    const messages = records
      .filter((record) => record.owner_id === ownerId && record.sender_id === ownerId)
      .sort((left, right) => {
        const queuedDelta = Date.parse(left.queued_at) - Date.parse(right.queued_at);
        return queuedDelta || left.id.localeCompare(right.id);
      })
      .map((record) => {
        const { owner_id, queued_at, ...message } = record;
        void owner_id;
        void queued_at;
        return message;
      });

    if (this.activeOwnerId === ownerId) {
      this.queuedCount.set(messages.length);
    }
    return messages;
  }

  async removeMessage(id: string): Promise<void> {
    const ownerId = this.currentOwnerId();
    if (!ownerId || !this.isIndexedDBAvailable()) return;

    const db = await this.ensureDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onerror = () => reject(new Error('Offline queue item could not be read'));
      request.onsuccess = () => {
        const record = request.result as QueuedChatMessage | undefined;
        if (record?.owner_id === ownerId) {
          store.delete(id);
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Offline queue item could not be removed'));
      transaction.onabort = () => reject(new Error('Offline queue item could not be removed'));
    });

    await this.refreshCount(ownerId);
  }

  /** Remove queued messages for the current account without touching another account's queue. */
  async clearQueue(): Promise<void> {
    const ownerId = this.currentOwnerId();
    if (!ownerId || !this.isIndexedDBAvailable()) {
      this.queuedCount.set(0);
      return;
    }

    const db = await this.ensureDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const index = transaction.objectStore(this.storeName).index(this.ownerIndexName);
      const request = index.openKeyCursor(ownerId);

      request.onerror = () => reject(new Error('Offline queue could not be cleared'));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        transaction.objectStore(this.storeName).delete(cursor.primaryKey);
        cursor.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Offline queue could not be cleared'));
      transaction.onabort = () => reject(new Error('Offline queue could not be cleared'));
    });

    if (this.activeOwnerId === ownerId) {
      this.queuedCount.set(0);
    }
  }
}
