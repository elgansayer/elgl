import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { HostDashboardService } from './host-dashboard.service';
import type { HostDashboardStats } from './host-dashboard.service';

describe('HostDashboardService', () => {
  let service: HostDashboardService;
  let randomSpy: ReturnType<typeof vi.spyOn>;
  let dateNowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HostDashboardService);
    randomSpy = vi.spyOn(Math, 'random');
    dateNowSpy = vi.spyOn(Date, 'now');
  });

  afterEach(() => {
    randomSpy.mockRestore();
    dateNowSpy.mockRestore();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getDashboardStats', () => {
    it('should emit a valid HostDashboardStats object', async () => {
      randomSpy
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(0.25);
      dateNowSpy.mockReturnValue(1_000_000);

      const stats: HostDashboardStats = await service.getDashboardStats('room-id');

      expect(stats).toEqual({
        viewerCount: 5,
        earnedCoins: 11,
        startTime: new Date(100_000),
      });

      // Validate the ranges are as defined in the implementation
      expect(stats.viewerCount).toBeGreaterThanOrEqual(5);
      expect(stats.viewerCount).toBeLessThanOrEqual(54);
      expect(stats.earnedCoins).toBeGreaterThanOrEqual(1);
      expect(stats.earnedCoins).toBeLessThanOrEqual(20);
      expect(stats.startTime).toBeInstanceOf(Date);
    });
  });
});
