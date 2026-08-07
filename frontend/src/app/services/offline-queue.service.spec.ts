/**
 * Tests for OfflineQueueService - IndexedDB-backed message queuing
 * for offline chat composition.
 */
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { OfflineQueueService } from './offline-queue.service';
import { ChatMessage } from './chat.service';

function fakeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: crypto.randomUUID?.() ?? 'test-id',
    room_id: 'room-1',
    sender_id: 'user-1',
    message_type: 'text',
    text_content: 'hello',
    is_read: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * A synchronous IDBRequest-like object. When `onsuccess` is set, the callback
 * fires immediately (same microtask). This matches the real IndexedDB behaviour
 * where onsuccess fires during the current task once the transaction completes.
 */
class SyncRequest<T> {
  result: T;
  error: unknown = null;
  private _onsuccess: (() => void) | null = null;
  private _onerror: (() => void) | null = null;

  constructor(result: T) {
    this.result = result;
  }

  set onsuccess(handler: (() => void) | null) {
    this._onsuccess = handler;
    if (handler) {
      // Fire synchronously like real IndexedDB
      handler();
    }
  }
  get onsuccess(): (() => void) | null {
    return this._onsuccess;
  }

  set onerror(handler: (() => void) | null) {
    this._onerror = handler;
  }
  get onerror(): (() => void) | null {
    return this._onerror;
  }
}

/** Minimal IndexedDB mock for testing with Vitest + jsdom. */
function createIndexedDBMock() {
  const store = new Map<string, ChatMessage>();

  const fakeDB = {
    objectStoreNames: {
      contains: (name: string) => name === 'messages',
    } as DOMStringList,
    transaction: () =>
      ({
        objectStore: () => ({
          put: (msg: ChatMessage) => {
            store.set(msg.id, msg);
            return new SyncRequest(msg) as unknown as IDBRequest;
          },
          getAll: () => new SyncRequest(Array.from(store.values())) as unknown as IDBRequest,
          delete: (id: string) => {
            store.delete(id);
            return new SyncRequest(undefined) as unknown as IDBRequest;
          },
          clear: () => {
            store.clear();
            return new SyncRequest(undefined) as unknown as IDBRequest;
          },
        }),
      }) as unknown as IDBTransaction,
  };

  const openRequest = new SyncRequest(fakeDB as unknown as IDBDatabase);

  const indexedDBMock = {
    open: vi.fn().mockReturnValue(openRequest as unknown as IDBOpenDBRequest),
  };

  return { indexedDBMock, store, openRequest, fakeDB };
}

describe('OfflineQueueService', () => {
  let service: OfflineQueueService;
  let mocks: ReturnType<typeof createIndexedDBMock>;

  beforeEach(() => {
    mocks = createIndexedDBMock();

    vi.stubGlobal('indexedDB', mocks.indexedDBMock);
    vi.stubGlobal('window', { indexedDB: mocks.indexedDBMock });

    TestBed.configureTestingModule({
      providers: [OfflineQueueService],
    });

    service = TestBed.inject(OfflineQueueService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialise with queueSize 0', () => {
    expect(service.queueSize()).toBe(0);
  });

  describe('enqueueMessage', () => {
    it('should enqueue a message and increment queueSize', async () => {
      const msg = fakeMessage({ id: 'msg-1' });
      await service.enqueueMessage(msg);

      expect(service.queueSize()).toBe(1);
      expect(mocks.store.get('msg-1')).toEqual(msg);
    });

    it('should enqueue multiple messages', async () => {
      await service.enqueueMessage(fakeMessage({ id: 'a' }));
      await service.enqueueMessage(fakeMessage({ id: 'b' }));
      await service.enqueueMessage(fakeMessage({ id: 'c' }));

      expect(service.queueSize()).toBe(3);
    });
  });

  describe('getQueuedMessages', () => {
    it('should return all queued messages', async () => {
      const a = fakeMessage({ id: 'a' });
      const b = fakeMessage({ id: 'b' });
      await service.enqueueMessage(a);
      await service.enqueueMessage(b);

      const result = await service.getQueuedMessages();
      expect(result).toHaveLength(2);
      expect(result.some((m) => m.id === 'a')).toBe(true);
      expect(result.some((m) => m.id === 'b')).toBe(true);
    });

    it('should return empty array when nothing queued', async () => {
      const result = await service.getQueuedMessages();
      expect(result).toEqual([]);
    });
  });

  describe('removeMessage', () => {
    it('should remove a message and decrement queueSize', async () => {
      await service.enqueueMessage(fakeMessage({ id: 'a' }));
      await service.enqueueMessage(fakeMessage({ id: 'b' }));
      expect(service.queueSize()).toBe(2);

      await service.removeMessage('a');
      expect(service.queueSize()).toBe(1);

      const remaining = await service.getQueuedMessages();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('b');
    });
  });

  describe('clearAll', () => {
    it('should clear all messages and reset queueSize to 0', async () => {
      await service.enqueueMessage(fakeMessage({ id: 'a' }));
      await service.enqueueMessage(fakeMessage({ id: 'b' }));
      expect(service.queueSize()).toBe(2);

      await service.clearAll();
      expect(service.queueSize()).toBe(0);

      const result = await service.getQueuedMessages();
      expect(result).toEqual([]);
    });
  });

  describe('SSR / non-browser guard', () => {
    it('should return silently from enqueueMessage when window is undefined', async () => {
      vi.stubGlobal('window', undefined as unknown);

      await service.enqueueMessage(fakeMessage());
      expect(service.queueSize()).toBe(0);
    });

    it('should return [] from getQueuedMessages when indexedDB is missing', async () => {
      vi.stubGlobal('window', {});

      const result = await service.getQueuedMessages();
      expect(result).toEqual([]);
    });
  });

  describe('queueSize reactivity', () => {
    it('should reflect the current queue length', async () => {
      expect(service.queueSize()).toBe(0);

      await service.enqueueMessage(fakeMessage({ id: 'x' }));
      expect(service.queueSize()).toBe(1);

      await service.enqueueMessage(fakeMessage({ id: 'y' }));
      expect(service.queueSize()).toBe(2);

      await service.removeMessage('x');
      expect(service.queueSize()).toBe(1);

      await service.clearAll();
      expect(service.queueSize()).toBe(0);
    });
  });
});