import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { ChatCacheService } from './chat-cache.service';
import type { ChatMessage, ChatRoom, FavouriteRecord } from './chat.service';
import { NetworkStatusService } from './network-status.service';

interface StoredRecord {
  key: string;
  data: unknown;
  cachedAt: number;
}

function syncReq(result?: unknown) {
  const request: Record<string, unknown> = { result: result ?? null, _onsuccess: null };
  Object.defineProperty(request, 'onsuccess', {
    get() {
      return request['_onsuccess'];
    },
    set(callback: (() => void) | null) {
      request['_onsuccess'] = callback;
      callback?.();
    },
  });
  return request;
}

function deferredReq(result?: unknown) {
  let callback: (() => void) | null = null;
  const request: Record<string, unknown> = { result: result ?? null };
  Object.defineProperty(request, 'onsuccess', {
    get() {
      return callback;
    },
    set(value: (() => void) | null) {
      callback = value;
    },
  });
  return {
    request,
    resolve: () => callback?.(),
  };
}

describe('ChatCacheService', () => {
  let service: ChatCacheService;
  let stores: Map<string, Map<string, StoredRecord>>;
  let currentUser: ReturnType<typeof signal<{ id: string } | null>>;
  let isOnline: ReturnType<typeof signal<boolean>>;
  let failTransactions: boolean;
  let deferNextGet: boolean;
  let releasePendingGet: (() => void) | null;
  let now: number;

  const message = (id: string, roomId = 'room-1'): ChatMessage => ({
    id,
    room_id: roomId,
    sender_id: 'user-a',
    message_type: 'text',
    text_content: `message ${id}`,
    is_read: false,
    created_at: '2026-08-01T00:00:00.000Z',
  });

  const room = (id: string): ChatRoom => ({
    id,
    title: `Room ${id}`,
    subtitle: '',
    avatar: '',
    is_online: true,
    is_pinned: false,
    created_at: '2026-08-01T00:00:00.000Z',
  });

  const favourite = (id: string): FavouriteRecord => ({
    id,
    user_id: 'user-a',
    item_type: 'message',
    item_payload: message(`message-${id}`),
    created_at: '2026-08-01T00:00:00.000Z',
  });

  function getStore(name: string): Map<string, StoredRecord> {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  }

  function objectStore(storeName: string) {
    const store = getStore(storeName);
    return {
      put: (value: StoredRecord) => {
        store.set(value.key, value);
        return syncReq();
      },
      get: (key: string) => {
        const result = store.get(key) ?? null;
        if (!deferNextGet) return syncReq(result);

        deferNextGet = false;
        const deferred = deferredReq(result);
        releasePendingGet = deferred.resolve;
        return deferred.request;
      },
      delete: (key: string) => {
        store.delete(key);
        return syncReq();
      },
      openCursor: () => syncReq(null),
    };
  }

  function buildDB() {
    return {
      objectStoreNames: { contains: () => true },
      transaction: (storeName: string) => {
        if (failTransactions) throw new Error('IndexedDB blocked');
        const transaction: Record<string, unknown> = {
          _oncomplete: null,
          _onerror: null,
          _onabort: null,
          error: null,
        };
        Object.defineProperty(transaction, 'oncomplete', {
          get() {
            return transaction['_oncomplete'];
          },
          set(callback: (() => void) | null) {
            transaction['_oncomplete'] = callback;
            if (callback) queueMicrotask(callback);
          },
        });
        transaction['objectStore'] = () => objectStore(storeName);
        return transaction;
      },
      close: vi.fn(),
      onversionchange: null,
    };
  }

  beforeEach(() => {
    stores = new Map();
    failTransactions = false;
    deferNextGet = false;
    releasePendingGet = null;
    now = 1_780_000_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    currentUser = signal<{ id: string } | null>({ id: 'user-a' });
    isOnline = signal(true);

    vi.stubGlobal('indexedDB', {
      open: () => syncReq(buildDB()),
    });

    TestBed.configureTestingModule({
      providers: [
        ChatCacheService,
        {
          provide: AuthService,
          useValue: { currentUser },
        },
        {
          provide: NetworkStatusService,
          useValue: { isOnline: isOnline.asReadonly() },
        },
      ],
    });
    service = TestBed.inject(ChatCacheService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('stores and retrieves a bounded room message snapshot', async () => {
    const messages = Array.from({ length: 520 }, (_, index) => message(String(index)));

    await service.cacheMessages('room-1', messages);
    const cached = await service.getCachedMessages('room-1');

    expect(cached).toHaveLength(500);
    expect(cached?.[0].id).toBe('20');
    expect(cached?.at(-1)?.id).toBe('519');
  });

  it('scopes private cache entries to the authenticated account', async () => {
    await service.cacheMessages('room-1', [message('a')]);
    await service.cacheRooms([room('a')]);
    await service.cacheFavourites([favourite('a')]);

    currentUser.set({ id: 'user-b' });

    await expect(service.getCachedMessages('room-1')).resolves.toBeNull();
    await expect(service.getCachedRooms()).resolves.toBeNull();
    await expect(service.getCachedFavourites()).resolves.toBeNull();

    await service.cacheMessages('room-1', [message('b')]);
    currentUser.set({ id: 'user-a' });

    await expect(service.getCachedMessages('room-1')).resolves.toEqual([message('a')]);
  });

  it('does not reveal or copy a pending read after the authenticated account changes', async () => {
    await service.cacheMessages('room-1', [message('a')]);

    deferNextGet = true;
    const append = service.appendCachedMessage('room-1', message('new'));

    while (!releasePendingGet) await Promise.resolve();
    currentUser.set({ id: 'user-b' });
    releasePendingGet();
    await append;

    await expect(service.getCachedMessages('room-1')).resolves.toBeNull();

    currentUser.set({ id: 'user-a' });
    await expect(service.getCachedMessages('room-1')).resolves.toEqual([message('a')]);
  });

  it('does not persist or reveal cache data without an authenticated account', async () => {
    currentUser.set(null);

    await expect(service.cacheMessages('room-1', [message('a')])).resolves.toBeUndefined();
    await expect(service.getCachedMessages('room-1')).resolves.toBeNull();

    currentUser.set({ id: 'user-a' });
    await expect(service.getCachedMessages('room-1')).resolves.toBeNull();
  });

  it('uses short freshness TTLs online but permits bounded stale reads offline', async () => {
    await service.cacheMessages('room-1', [message('a')]);

    now += 6 * 60 * 1000;
    await expect(service.getCachedMessages('room-1')).resolves.toBeNull();

    isOnline.set(false);
    await expect(service.getCachedMessages('room-1')).resolves.toEqual([message('a')]);

    now += 8 * 24 * 60 * 60 * 1000;
    await expect(service.getCachedMessages('room-1')).resolves.toBeNull();
  });

  it('rejects future-dated records that could outlive the retention boundary', async () => {
    isOnline.set(false);
    getStore('chatMessages').set('v2:user-a:messages:room-1', {
      key: 'v2:user-a:messages:room-1',
      data: [message('future')],
      cachedAt: now + 8 * 24 * 60 * 60 * 1000,
    });

    await expect(service.getCachedMessages('room-1')).resolves.toBeNull();
  });

  it('deduplicates API and realtime echoes while keeping the newest payload', async () => {
    await service.cacheMessages('room-1', [message('same')]);
    const updated = { ...message('same'), text_content: 'edited' };

    await service.appendCachedMessage('room-1', updated);

    await expect(service.getCachedMessages('room-1')).resolves.toEqual([updated]);
  });

  it('does not create a partial room snapshot when append has no existing cache', async () => {
    await service.appendCachedMessage('room-1', message('new'));

    await expect(service.getCachedMessages('room-1')).resolves.toBeNull();
  });

  it('invalidates messages, rooms and favourites only for the current account', async () => {
    await service.cacheMessages('room-1', [message('a')]);
    await service.cacheRooms([room('a')]);
    await service.cacheFavourites([favourite('a')]);

    currentUser.set({ id: 'user-b' });
    await service.cacheMessages('room-1', [message('b')]);
    await service.cacheRooms([room('b')]);
    await service.cacheFavourites([favourite('b')]);

    await service.invalidateMessages('room-1');
    await service.invalidateRooms();
    await service.invalidateFavourites();

    currentUser.set({ id: 'user-a' });
    await expect(service.getCachedMessages('room-1')).resolves.toEqual([message('a')]);
    await expect(service.getCachedRooms()).resolves.toEqual([room('a')]);
    await expect(service.getCachedFavourites()).resolves.toEqual([favourite('a')]);
  });

  it('bounds room and favourite collection cache sizes', async () => {
    await service.cacheRooms(Array.from({ length: 300 }, (_, index) => room(String(index))));
    await service.cacheFavourites(
      Array.from({ length: 550 }, (_, index) => favourite(String(index))),
    );

    await expect(service.getCachedRooms()).resolves.toHaveLength(250);
    await expect(service.getCachedFavourites()).resolves.toHaveLength(500);
  });

  it('rejects malformed persisted entries instead of trusting IndexedDB contents', async () => {
    getStore('chatMessages').set('v2:user-a:messages:room-1', {
      key: 'v2:user-a:messages:room-1',
      data: { text_content: 'not an array' },
      cachedAt: now,
    });

    await expect(service.getCachedMessages('room-1')).resolves.toBeNull();
  });

  it('degrades cache read, write and invalidation failures without breaking chat callers', async () => {
    failTransactions = true;

    await expect(service.cacheMessages('room-1', [message('a')])).resolves.toBeUndefined();
    await expect(service.getCachedMessages('room-1')).resolves.toBeNull();
    await expect(service.invalidateMessages('room-1')).resolves.toBeUndefined();
  });
});
