import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';
import { ChatMessage } from './chat.service';

export interface QueuedMessage {
  id: string;
  room_id: string;
  sender_id: string;
  message_type: ChatMessage['message_type'];
  text_content?: string;
  media_url?: string;
  correction_payload?: ChatMessage['correction_payload'];
  correction_request_payload?: ChatMessage['correction_request_payload'];
  reply_to_id?: string;
  status_reply_payload?: ChatMessage['status_reply_payload'];
  /** Timestamp when the message was queued locally */
  queued_at: string;
  /** Number of delivery attempts made so far */
  retry_count: number;
}

const DB_NAME = 'chat_offline_db';
const STORE_NAME = 'messages';
const DB_VERSION = 2;

@Injectable({
  providedIn: 'root',
})
export class OfflineQueueService {
  private dbPromise: Promise<IDBPDatabase> | null = null;
  private readonly browserSupported: boolean;

  constructor() {
    this.browserSupported =
      typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
    if (this.browserSupported) {
      this.dbPromise = this.initDB();
    }
  }

  private initDB(): Promise<IDBPDatabase> {
    return openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        if (oldVersion < 2) {
          // Migrate existing records to add queued_at and retry_count defaults
          // The idb library handles store existence; we just ensure the store exists
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        }
      },
    });
  }

  private async ensureDB(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      throw new Error('IndexedDB not available in this environment');
    }
    return this.dbPromise;
  }

  private toQueuedMessage(msg: ChatMessage): QueuedMessage {
    return {
      id: msg.id,
      room_id: msg.room_id,
      sender_id: msg.sender_id,
      message_type: msg.message_type,
      text_content: msg.text_content,
      media_url: msg.media_url,
      correction_payload: msg.correction_payload,
      correction_request_payload: msg.correction_request_payload,
      reply_to_id: msg.reply_to_id,
      status_reply_payload: msg.status_reply_payload,
      queued_at: new Date().toISOString(),
      retry_count: 0,
    };
  }

  async enqueueMessage(message: ChatMessage): Promise<void> {
    if (!this.browserSupported) return;
    const db = await this.ensureDB();
    await db.put(STORE_NAME, this.toQueuedMessage(message));
  }

  async getQueuedMessages(): Promise<QueuedMessage[]> {
    if (!this.browserSupported) return [];
    const db = await this.ensureDB();
    return db.getAll(STORE_NAME);
  }

  async removeMessage(id: string): Promise<void> {
    if (!this.browserSupported) return;
    const db = await this.ensureDB();
    await db.delete(STORE_NAME, id);
  }

  async incrementRetryCount(id: string): Promise<void> {
    if (!this.browserSupported) return;
    const db = await this.ensureDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const existing = await store.get(id);
    if (existing) {
      existing.retry_count = (existing.retry_count || 0) + 1;
      await store.put(existing);
    }
    await tx.done;
  }

  async clearAll(): Promise<void> {
    if (!this.browserSupported) return;
    const db = await this.ensureDB();
    await db.clear(STORE_NAME);
  }
}
