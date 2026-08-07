import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { OfflineReadingService } from './offline-reading.service';
import { NetworkStatusService } from './network-status.service';

describe('OfflineReadingService', () => {
  let service: OfflineReadingService;
  let mockStores: Map<string, Map<string, unknown>>;
  let openCallbacks: Record<string, (() => void) | ((event: unknown) => void) | null>;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('no IndexedDB', () => {
    beforeEach(() => {
      vi.stubGlobal('indexedDB', undefined);
    });

    it('should create via TestBed', () => {
      const testBed = TestBed.configureTestingModule({
        providers: [OfflineReadingService],
      });
      service = testBed.inject(OfflineReadingService);
      expect(service).toBeTruthy();
    });

    it('should return empty articles', async () => {
      const testBed = TestBed.configureTestingModule({
        providers: [OfflineReadingService],
      });
      service = testBed.inject(OfflineReadingService);
      const result = await service.getCachedArticles();
      expect(result).toEqual([]);
    });

    it('should return empty history', async () => {
      const testBed = TestBed.configureTestingModule({
        providers: [OfflineReadingService],
      });
      service = testBed.inject(OfflineReadingService);
      const result = await service.getReadingHistory();
      expect(result).toEqual([]);
    });
  });
});
