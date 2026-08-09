import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { OfflineQueueService } from './offline-queue.service';
import { ChatMessage } from './chat.service';

function createMockMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    room_id: 'room-1',
    sender_id: 'user-1',
    message_type: 'text',
    text_content: 'Hello',
    is_read: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('OfflineQueueService', () => {
  let service: OfflineQueueService;
  let mockStore: Map<string, ChatMessage>;

  function createSyncRequest(result?: unknown) {
    // Fire onsuccess synchronously once it's set (using a MutationObserver-like pattern with defineProperty)
    const req = {
      result: result ?? null,
      error: null as DOMException | null,
      _onsuccess: null as (() => void) | null,
    };
    Object.defineProperty(req, 'onsuccess', {
      get() { return this._onsuccess; },
      set(fn: () => void) {
        this._onsuccess = fn;
        // Fire synchronously so the IDB promise resolves immediately
        fn();
      },
    });
    return req;
  }

  beforeEach(() => {
    mockStore = new Map<string, ChatMessage>();

    vi.stubGlobal('indexedDB', {
      open: () => {
        const req = createSyncRequest();
        // The mock DB object
        req.result = {
          objectStoreNames: { contains: () => true },
          transaction: () => ({
            objectStore: () => ({
              put: (msg: ChatMessage) => {
                mockStore.set(msg.id, msg);
                return createSyncRequest();
              },
              getAll: () => {
                const r = createSyncRequest();
                r.result = Array.from(mockStore.values());
                return r;
              },
              delete: (id: string) => {
                mockStore.delete(id);
                return createSyncRequest();
              },
              clear: () => {
                mockStore.clear();
                return createSyncRequest();
              },
            }),
          }),
        };
        return req;
      },
    });

    TestBed.configureTestingModule({});
    service = TestBed.inject(OfflineQueueService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have zero queued count after initialisation', () => {
    expect(service.queuedCount()).toBe(0);
  });

  it('should enqueue a message and update count', async () => {
    const msg = createMockMessage();
    await service.enqueueMessage(msg);
    expect(mockStore.has('msg-1')).toBe(true);
    expect(service.queuedCount()).toBe(1);
  });

  it('should return queued messages', async () => {
    const msg1 = createMockMessage({ id: 'msg-1' });
    const msg2 = createMockMessage({ id: 'msg-2', text_content: 'World' });
    await service.enqueueMessage(msg1);
    await service.enqueueMessage(msg2);

    const messages = await service.getQueuedMessages();
    expect(messages).toHaveLength(2);
  });

  it('should remove a message and decrement count', async () => {
    const msg = createMockMessage();
    await service.enqueueMessage(msg);
    expect(service.queuedCount()).toBe(1);

    await service.removeMessage('msg-1');
    expect(mockStore.has('msg-1')).toBe(false);
    expect(service.queuedCount()).toBe(0);
  });

  it('should clear all queued messages', async () => {
    await service.enqueueMessage(createMockMessage({ id: 'msg-1' }));
    await service.enqueueMessage(createMockMessage({ id: 'msg-2' }));
    expect(service.queuedCount()).toBe(2);

    await service.clearQueue();
    const messages = await service.getQueuedMessages();
    expect(messages).toHaveLength(0);
    expect(service.queuedCount()).toBe(0);
  });

  it('should return empty array when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const noDBService = TestBed.inject(OfflineQueueService);

    const messages = await noDBService.getQueuedMessages();
    expect(messages).toEqual([]);
  });

  it('should not throw when enqueuing without IndexedDB', async () => {
    vi.stubGlobal('indexedDB', undefined);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const noDBService = TestBed.inject(OfflineQueueService);

    await expect(noDBService.enqueueMessage(createMockMessage())).resolves.toBeUndefined();
    expect(noDBService.queuedCount()).toBe(0);
  });
});