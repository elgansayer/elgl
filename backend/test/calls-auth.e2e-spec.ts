import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SupabaseAuthGuard } from '../src/auth/supabase-auth.guard';
import { CallsController } from '../src/calls/calls.controller';
import { CallsService } from '../src/calls/calls.service';
import { SupabaseService } from '../src/supabase/supabase.service';

describe('Calls API authentication (e2e)', () => {
  let app: INestApplication;

  const getUser = vi.fn().mockResolvedValue({
    data: { user: { id: 'authenticated-user' } },
    error: null,
  });
  const service = {
    initiateCall: vi.fn().mockResolvedValue({ call_id: 'call-1' }),
    createGroupCall: vi.fn(),
    getActiveCalls: vi.fn().mockReturnValue([{ room_name: 'room-1', e2ee_key: 'fixture-key' }]),
    getActiveCall: vi.fn().mockReturnValue({ room_name: 'room-1', e2ee_key: 'fixture-key' }),
    getWaitingCalls: vi.fn().mockReturnValue([{ room_name: 'room-1', callee_token: 'fixture-token' }]),
    switchCall: vi.fn(),
    acceptWaitingCall: vi.fn(),
    holdCall: vi.fn(),
    resumeCall: vi.fn(),
    leaveCall: vi.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CallsController],
      providers: [
        { provide: CallsService, useValue: service },
        { provide: SupabaseAuthGuard, useClass: SupabaseAuthGuard },
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ auth: { getUser } }) },
        },
        { provide: 'PinoLogger:CallsController', useValue: {} },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  const anonymousRoutes = [
    ['post', '/api/calls/initiate', { callee_id: 'callee-1' }],
    ['post', '/api/calls/group', { participant_ids: ['callee-1'] }],
    ['get', '/api/calls/active', undefined],
    ['get', '/api/calls/active/room-1', undefined],
    ['get', '/api/calls/waiting', undefined],
    ['put', '/api/calls/switch', { current_room_name: 'room-1', target_room_name: 'room-2' }],
    ['put', '/api/calls/room-1/accept-waiting', undefined],
    ['put', '/api/calls/room-1/hold', undefined],
    ['put', '/api/calls/room-1/resume', undefined],
    ['put', '/api/calls/room-1/leave', undefined],
  ] as const;

  it.each(anonymousRoutes)('rejects anonymous %s %s with 401',
    async (method, path, body) => {
      const call = request(app.getHttpServer())[method](path);
      if (body) {
        call.send(body);
      }
      await call.expect(401);
      expect(getUser).not.toHaveBeenCalled();
      for (const method of Object.values(service)) {
        expect(method).not.toHaveBeenCalled();
      }
    },
  );

  it('rejects an unverified bearer token', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'invalid token' } });
    await request(app.getHttpServer())
      .post('/api/calls/initiate')
      .set('Authorization', 'Bearer bad-token')
      .send({ callee_id: 'callee-1' })
      .expect(401);

    expect(service.initiateCall).not.toHaveBeenCalled();
  });

  it('uses the verified Supabase user when initiating a call', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/calls/initiate')
      .set('Authorization', 'Bearer test-token')
      .send({ callee_id: 'callee-1', is_video: true })
      .expect(201);

    expect(service.initiateCall).toHaveBeenCalledWith(
      'authenticated-user',
      'callee-1',
      true,
    );
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['cdn-cache-control']).toBe('private, no-store');
  });

  it.each([
    ['/api/calls/active', service.getActiveCalls],
    ['/api/calls/active/room-1', service.getActiveCall],
    ['/api/calls/waiting', service.getWaitingCalls],
  ])('never caches credential-bearing GET %s', async (path, handler) => {
    const response = await request(app.getHttpServer())
      .get(path)
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(handler).toHaveBeenCalled();
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['cdn-cache-control']).toBe('private, no-store');
    expect(response.headers['cache-tag']).toBeUndefined();
  });
});
