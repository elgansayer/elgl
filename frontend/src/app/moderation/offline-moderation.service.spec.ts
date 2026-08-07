import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { OfflineModerationService } from './offline-moderation.service';

describe('OfflineModerationService', () => {
  let service: OfflineModerationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2, 8) });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        OfflineModerationService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(OfflineModerationService);
    httpMock = TestBed.inject(HttpTestingController);
    Object.defineProperty(service, 'isOnline', { get: () => true, configurable: true });
  });

  afterEach(() => {
    httpMock.verify();
    vi.unstubAllGlobals();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have initial state', () => {
    expect(service.pendingActionCount()).toBe(0);
    expect(service.lastSyncFailed()).toBe(false);
    expect(service.isOnline).toBe(true);
  });

  it('should not sync when offline (no IDB)', async () => {
    Object.defineProperty(service, 'isOnline', { get: () => false, configurable: true });
    const result = await service.syncPendingActions();
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('should return empty pending actions when no IDB', async () => {
    const actions = await service.getPendingActions();
    expect(actions).toEqual([]);
  });

  it('should gracefully no-op cache/queue when no IDB', async () => {
    await expect(service.cacheItems([])).resolves.toBeUndefined();
    await expect(service.queueAction('test', 'approve', 'profile')).resolves.toBeUndefined();
  });
});