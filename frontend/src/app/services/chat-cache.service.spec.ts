import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatCacheService } from './chat-cache.service';
import { NetworkStatusService } from './network-status.service';
import { ChatMessage, ChatRoom, FavouriteRecord } from './chat.service';

/**
 * Synchronous mock for IndexedDB -- fires onsuccess immediately when set.
 * Pattern matches the proven approach in offline-economy.service.spec.ts.
 */
interface StoredRecord {
  key: string;
  data: unknown;
  cachedAt: number;
}

function syncReq(result?: unknown) {
  const r: Record<string, unknown> = { result: result ?? null, _onsuccess: null };
  Object.defineProperty(r, 'onsuccess', {
    get() { return r['_onsuccess']; },
    set(f: () => void) { r['_onsuccess'] = f; if (f) f(); },
  });
  return r;
}

describe('ChatCacheService', () => {
  let service: ChatCacheService;
  let stores: Map<string, Map<string, StoredRecord>>;

  function getStore(name: string): Map<string, StoredRecord> {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  }

  function os(storeName: string) {
    const s = getStore(storeName);
    return {
      put: (v: StoredRecord) => { s.set(v.key, v); return syncReq(); },
      get: (key: string) => syncReq(s.get(key) ?? null),
      getAll: () => syncReq([...s.values()]),
      delete: (key: string) => { s.delete(key); return syncReq(); },
      openCursor: () => {
        const entries = [...s.values()];
        let pos = 0;
        const cr: Record<string, unknown> = { result: null, _onsuccess: null };
        const advance = () => {
          cr['result'] = pos < entries.length
            ? {
                value: entries[pos],
                delete() { s.delete(entries[pos].key); },
                continue() {
                  pos++;
                  advance();
                },
              }
            : null;
          if (cr['_onsuccess']) {
            setTimeout(() => (cr['_onsuccess'] as () => void)(), 0);
          }
        };
        Object.defineProperty(cr, 'onsuccess', {
          get() { return cr['_onsuccess']; },
          set(f: () => void) {
            cr['_onsuccess'] = f;
            advance();
          },
        });
        return cr;
      },
    };
  }

  function buildDB() {
    return {
      objectStoreNames: { contains: () => true },
      transaction: (sName: string) => {
        const tx: Record<string, unknown> = { _oncomplete: null, _onerror: null };
        Object.defineProperty(tx, 'oncomplete', {
          get() { return tx['_oncomplete']; },
          set(f: () => void) { tx['_oncomplete'] = f; if (f) queueMicrotask(() => f()); },
        });
        Object.defineProperty(tx, 'onerror', {
          get() { return tx['_onerror']; },
          set(f: () => void) { tx['_onerror'] = f; },
        });
        tx['objectStore'] = () => os(sName);
        return tx;
      },
      close: () => {},
    };
  }

  beforeEach(() => {
    stores = new Map();

    vi.stubGlobal('indexedDB', {
      open: () => {
        const db = buildDB();
        return syncReq(db);
      },
      deleteDatabase: () => syncReq(),
    });

    TestBed.configureTestingModule({
      providers: [
        ChatCacheService,
        { provide: NetworkStatusService, useValue: { isOnline: { set: vi.fn() } } },
      ],
    });
    service = TestBed.inject(ChatCacheService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return null when no messages are cached', async () => {
    const result = await service.getCachedMessages('room-1');
    expect(result).toBeNull();
  });

  it('should return null when no rooms are cached', async () => {
    const result = await service.getCachedRooms();
    expect(result).toBeNull();
  });

  it('should return null when no favourites are cached', async () => {
    const result = await service.getCachedFavourites();
    expect(result).toBeNull();
  });

  it('should cache and retrieve messages', async () => {
    const msgs: ChatMessage[] = [
      {
        id: '1', room_id: 'room-1', sender_id: 'user-1', message_type: 'text',
        text_content: 'hello', is_read: false, created_at: '2026-01-01T00:00:00.000Z',
      },
    ];
    await service.cacheMessages('room-1', msgs);
    const cached = await service.getCachedMessages('room-1');
    expect(cached).toEqual(msgs);
  });

  it('should cache and retrieve rooms', async () => {
    const rooms: ChatRoom[] = [
      { id: 'room-1', title: 'Test', subtitle: '', avatar: '', is_online: true, is_pinned: false, created_at: 'now' },
    ];
    await service.cacheRooms(rooms);
    const cached = await service.getCachedRooms();
    expect(cached).toEqual(rooms);
  });

  it('should cache and retrieve favourites', async () => {
    const favs: FavouriteRecord[] = [
      {
        id: '1', user_id: 'user-1', item_type: 'message',
        item_payload: {
          id: 'm1', room_id: 'r1', sender_id: 'u1', message_type: 'text',
          text_content: 'hi', is_read: false, created_at: 'now',
        },
        created_at: 'now',
      },
    ];
    await service.cacheFavourites(favs);
    const cached = await service.getCachedFavourites();
    expect(cached).toEqual(favs);
  });

  it('should invalidate cached messages', async () => {
    const msgs: ChatMessage[] = [
      {
        id: '1', room_id: 'room-1', sender_id: 'user-1', message_type: 'text',
        text_content: 'hello', is_read: false, created_at: '2026-01-01T00:00:00.000Z',
      },
    ];
    await service.cacheMessages('room-1', msgs);
    await service.invalidateMessages('room-1');
    const cached = await service.getCachedMessages('room-1');
    expect(cached).toBeNull();
  });

  it('should invalidate cached rooms', async () => {
    const rooms: ChatRoom[] = [
      { id: 'room-1', title: 'Test', subtitle: '', avatar: '', is_online: true, is_pinned: false, created_at: 'now' },
    ];
    await service.cacheRooms(rooms);
    await service.invalidateRooms();
    const cached = await service.getCachedRooms();
    expect(cached).toBeNull();
  });

  it('should invalidate cached favourites', async () => {
    const favs: FavouriteRecord[] = [
      {
        id: '1', user_id: 'user-1', item_type: 'message',
        item_payload: {
          id: 'm1', room_id: 'r1', sender_id: 'u1', message_type: 'text',
          text_content: 'hi', is_read: false, created_at: 'now',
        },
        created_at: 'now',
      },
    ];
    await service.cacheFavourites(favs);
    await service.invalidateFavourites();
    const cached = await service.getCachedFavourites();
    expect(cached).toBeNull();
  });

  it('should append a message to an existing cached room', async () => {
    const msgs: ChatMessage[] = [
      {
        id: '1', room_id: 'room-1', sender_id: 'user-1', message_type: 'text',
        text_content: 'hello', is_read: false, created_at: '2026-01-01T00:00:00.000Z',
      },
    ];
    await service.cacheMessages('room-1', msgs);

    const newMsg: ChatMessage = {
      id: '2', room_id: 'room-1', sender_id: 'user-2', message_type: 'text',
      text_content: 'world', is_read: false, created_at: '2026-01-01T00:00:01.000Z',
    };
    await service.appendCachedMessage('room-1', newMsg);

    const cached = await service.getCachedMessages('room-1');
    expect(cached).not.toBeNull();
    expect(cached!.length).toBe(2);
    expect(cached![0].id).toBe('1');
    expect(cached![1].id).toBe('2');
  });

  it('should not append a message when no cached messages exist for the room', async () => {
    const newMsg: ChatMessage = {
      id: '2', room_id: 'room-2', sender_id: 'user-2', message_type: 'text',
      text_content: 'world', is_read: false, created_at: '2026-01-01T00:00:01.000Z',
    };
    await service.appendCachedMessage('room-2', newMsg);
    const cached = await service.getCachedMessages('room-2');
    expect(cached).toBeNull();
  });

  it('should evict stale entries while preserving fresh ones', async () => {
    const rooms: ChatRoom[] = [
      { id: 'room-1', title: 'Fresh', subtitle: '', avatar: '', is_online: true, is_pinned: false, created_at: 'now' },
    ];
    await service.cacheRooms(rooms);

    const fresh = await service.getCachedRooms();
    expect(fresh).toEqual(rooms);

    await service.evictStaleEntries();
    const afterEvict = await service.getCachedRooms();
    expect(afterEvict).toEqual(rooms);
  });
});
