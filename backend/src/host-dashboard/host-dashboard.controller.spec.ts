import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { HostDashboardController } from './host-dashboard.controller';
import { HostDashboardService } from './host-dashboard.service';

describe('HostDashboardController', () => {
  const roomId = 'room-1';
  const host = { id: 'host-1' } as User;

  function createController() {
    const service = {
      getStats: vi.fn().mockResolvedValue({
        roomId,
        viewerCount: 7,
        earnedCoins: 35,
        startTime: new Date('2026-08-29T12:00:00.000Z'),
      }),
    } as unknown as HostDashboardService;

    return {
      controller: new HostDashboardController(service),
      service,
    };
  }

  it('requires the Supabase authentication guard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      HostDashboardController,
    ) as unknown[];

    expect(guards).toContain(SupabaseAuthGuard);
  });

  it('passes the authenticated user id to the service', async () => {
    const { controller, service } = createController();

    await controller.getStats(host, roomId);

    expect(service.getStats).toHaveBeenCalledWith(roomId, host.id);
  });

  it('rejects a request without an authenticated user', async () => {
    const { controller, service } = createController();

    await expect(controller.getStats(null, roomId)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(service.getStats).not.toHaveBeenCalled();
  });
});
