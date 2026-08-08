import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ChatCacheService } from './chat-cache.service';
import { NetworkStatusService } from './network-status.service';

describe('ChatCacheService', () => {
  let service: ChatCacheService;

  beforeEach(() => {
    // Remove indexedDB from global scope so the service skips DB init
    // and exercises the no-op / fallback paths
    if ('indexedDB' in globalThis) {
      vi.stubGlobal('indexedDB', undefined);
    }

    TestBed.configureTestingModule({
      providers: [
        {
          provide: NetworkStatusService,
          useValue: { isOnline: signal(true) },
        },
      ],
    });

    service = TestBed.inject(ChatCacheService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return null when indexedDB is not available (messages)', async () => {
    const result = await service.getCachedMessages('room-1');
    expect(result).toBeNull();
  });

  it('should return null when indexedDB is not available (rooms)', async () => {
    const result = await service.getCachedRooms();
    expect(result).toBeNull();
  });

  it('should return null when indexedDB is not available (favourites)', async () => {
    const result = await service.getCachedFavourites();
    expect(result).toBeNull();
  });

  it('should return null when indexedDB is not available (members)', async () => {
    const result = await service.getCachedRoomMembers('room-1');
    expect(result).toBeNull();
  });

  it('should expose online status from network service', () => {
    expect(service.isOnline()).toBe(true);
  });

  it('should not throw when calling clearAll without indexedDB', async () => {
    await expect(service.clearAll()).resolves.toBeUndefined();
  });

  it('should not throw when calling evictStaleEntries without indexedDB', async () => {
    await expect(service.evictStaleEntries()).resolves.toBeUndefined();
  });

  it('should not throw when calling invalidateMessages without indexedDB', async () => {
    await expect(service.invalidateMessages('room-1')).resolves.toBeUndefined();
  });
});