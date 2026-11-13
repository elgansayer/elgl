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
  const initiateDto = { callee_id: 'callee-1', is_video: true };
  const groupDto = { participant_ids: ['callee-1'] };
  const switchDto = {
    current_room_name: 'room-1',
    target_room_name: 'room-2',
  };
  const handlers = {
    initiate: (user: User | null) => controller.initiateCall(user, initiateDto),
    group: (user: User | null) => controller.createGroupCall(user, groupDto),
    active: (user: User | null) => controller.getActiveCalls(user),
    details: (user: User | null) => controller.getActiveCall(user, 'room-1'),
    waiting: (user: User | null) => controller.getWaitingCalls(user),
    switch: (user: User | null) => controller.switchCall(user, switchDto),
    accept: (user: User | null) => controller.acceptWaitingCall(user, 'room-1'),
    hold: (user: User | null) => controller.holdCall(user, 'room-1'),
    resume: (user: User | null) => controller.resumeCall(user, 'room-1'),
    leave: (user: User | null) => controller.leaveCall(user, 'room-1'),
  };

  const routes: Array<[string, (user: User | null) => unknown]> = [
    ['POST /calls/initiate', handlers.initiate],
    ['POST /calls/group', handlers.group],
    ['GET /calls/active', handlers.active],
    ['GET /calls/active/:room_name', handlers.details],
    ['GET /calls/waiting', handlers.waiting],
    ['PUT /calls/switch', handlers.switch],
    ['PUT /calls/:room_name/accept-waiting', handlers.accept],
    ['PUT /calls/:room_name/hold', handlers.hold],
    ['PUT /calls/:room_name/resume', handlers.resume],
    ['PUT /calls/:room_name/leave', handlers.leave],
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires SupabaseAuthGuard on every route', () => {
    expect(Reflect.getMetadata('__guards__', CallsController)).toContain(
      SupabaseAuthGuard,
    );
  });

  it.each(routes)('rejects missing user: %s', async (_route, invoke) => {
    await expect(Promise.resolve().then(() => invoke(null))).rejects.toThrow(
      UnauthorizedException,
    );
    for (const method of Object.values(service)) {
      expect(method).not.toHaveBeenCalled();
    }
  });

  it.each(routes)('rejects missing user ID: %s', async (_route, invoke) => {
    await expect(
      Promise.resolve().then(() => invoke({ id: '' } as User)),
    ).rejects.toThrow(UnauthorizedException);
    for (const method of Object.values(service)) {
      expect(method).not.toHaveBeenCalled();
    }
  });

  it.each(routes)(
    'passes authenticated user ID: %s',
    async (_route, invoke) => {
      await Promise.resolve(invoke({ id: 'authenticated-user' } as User));
      const calls = Object.values(service).flatMap(
        (method) => method.mock.calls,
      );
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toBe('authenticated-user');
    },
  );
});
