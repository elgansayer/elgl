import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { StatsService, UserStats } from './stats.service';
import { ApiService } from './api.service';

const MOCK_STATS: UserStats = {
  translations_count: 5,
  corrections_count: 45,
  messages_count: 340,
  moments_count: 12,
};

describe('StatsService', () => {
  let service: StatsService;
  let apiGet: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    apiGet = vi.fn().mockResolvedValue(MOCK_STATS);

    await TestBed.configureTestingModule({
      providers: [
        StatsService,
        { provide: ApiService, useValue: { get: apiGet } },
      ],
    }).compileComponents();

    service = TestBed.inject(StatsService);
  });

  it('should be created', () => {
    expect(service).toBeDefined();
  });

  it('should call GET /stats/me and return user stats', async () => {
    const result = await service.getMyStats();

    expect(apiGet).toHaveBeenCalledWith('/stats/me');
    expect(result).toEqual(MOCK_STATS);
  });

  it('should propagate API errors', async () => {
    apiGet.mockRejectedValue(new Error('Unauthorised'));

    await expect(service.getMyStats()).rejects.toThrow('Unauthorised');
  });
});