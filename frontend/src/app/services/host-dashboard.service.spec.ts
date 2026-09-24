import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { ApiService } from './api.service';
import { HostDashboardService } from './host-dashboard.service';

describe('HostDashboardService', () => {
  const api = { get: vi.fn() };
  let service: HostDashboardService;

  beforeEach(() => {
    api.get.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: api }],
    });
    service = TestBed.inject(HostDashboardService);
  });

  it('loads authenticated persisted statistics for the requested room', async () => {
    api.get.mockResolvedValue({
      roomId: 'room/one',
      viewerCount: 12,
      earnedCoins: 35,
      startTime: '2026-08-29T12:00:00.000Z',
    });

    await expect(service.getDashboardStats('room/one')).resolves.toEqual({
      viewerCount: 12,
      earnedCoins: 35,
      startTime: new Date('2026-08-29T12:00:00.000Z'),
    });
    expect(api.get).toHaveBeenCalledWith(`${environment.apiUrl}/host-dashboard/room%2Fone/stats`, {
      fallback: expect.objectContaining({
        roomId: 'room/one',
        viewerCount: 0,
        earnedCoins: 0,
      }),
    });
  });

  it('fails closed without fabricating statistics when the API rejects', async () => {
    api.get.mockRejectedValue(new Error('network unavailable'));

    const stats = await service.getDashboardStats('room-1');

    expect(stats.viewerCount).toBe(0);
    expect(stats.earnedCoins).toBe(0);
    expect(stats.startTime).toBeInstanceOf(Date);
  });
});
