import { UnauthorizedException } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import type { PinoLogger } from 'nestjs-pino';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';

describe('CallsController authentication', () => {
  const service = {
    initiateCall: vi.fn(),
    createGroupCall: vi.fn(),
    getActiveCalls: vi.fn(),
    getActiveCall: vi.fn(),
    getWaitingCalls: vi.fn(),
    switchCall: vi.fn(),
    acceptWaitingCall: vi.fn(),
    holdCall: vi.fn(),
    resumeCall: vi.fn(),
    leaveCall: vi.fn(),
  };
  const controller = new CallsController(
    service as unknown as CallsService,
    {} as PinoLogger,
  );

  const routes: Array<[string, (user: User | null) => unknown]> = [
    ['POST /calls/initiate', (user) =>
      controller.initiateCall(user, { callee_id: 'callee-1', is_video: true })],
    ['POST /calls/group', (user) =>
      controller.createGroupCall(user, { participant_ids: ['callee-1'] })],
    ['GET /calls/active', (user) => controller.getActiveCalls(user)],
    ['GET /calls/active/:room_name', (user) =>
      controller.getActiveCall(user, 'room-1')],
    ['GET /calls/waiting', (user) => controller.getWaitingCalls(user)],
    ['PUT /calls/switch', (user) =>
      controller.switchCall(user, {
        current_room_name: 'room-1',
        target_room_name: 'room-2',
      })],
    ['PUT /calls/:room_name/accept-waiting', (user) =>
      controller.acceptWaitingCall(user, 'room-1')],
    ['PUT /calls/:room_name/hold', (user) =>
      controller.holdCall(user, 'room-1')],
    ['PUT /calls/:room_name/resume', (user) =>
      controller.resumeCall(user, 'room-1')],
    ['PUT /calls/:room_name/leave', (user) =>
      controller.leaveCall(user, 'room-1')],
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires SupabaseAuthGuard on every route', () => {
    expect(Reflect.getMetadata('__guards__', CallsController)).toContain(
      SupabaseAuthGuard,
    );
  });

  it.each(routes)('%s rejects a missing resolved user before accessing the service',
    async (_route, invoke) => {
      await expect(Promise.resolve().then(() => invoke(null))).rejects.toThrow(
        UnauthorizedException,
      );
      for (const method of Object.values(service)) {
        expect(method).not.toHaveBeenCalled();
      }
    },
  );

  it.each(routes)('%s rejects a user without an ID',
    async (_route, invoke) => {
      await expect(
        Promise.resolve().then(() => invoke({ id: '' } as User)),
      ).rejects.toThrow(UnauthorizedException);
      for (const method of Object.values(service)) {
        expect(method).not.toHaveBeenCalled();
      }
    },
  );

  it.each(routes)('%s scopes the service call to the authenticated user',
    async (_route, invoke) => {
      await Promise.resolve(invoke({ id: 'authenticated-user' } as User));
      const calls = Object.values(service).flatMap((method) => method.mock.calls);
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toBe('authenticated-user');
    },
  );
});
