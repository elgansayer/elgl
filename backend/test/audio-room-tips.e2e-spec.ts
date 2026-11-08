import type { Request } from 'express';
import request from 'supertest';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AudioRoomsController } from '../src/audio-rooms/audio-rooms.controller';
import { AudioRoomsService } from '../src/audio-rooms/audio-rooms.service';
import { SupabaseAuthGuard } from '../src/auth/supabase-auth.guard';

describe('Audio-room tip API', () => {
  const roomId = '63eedbd6-03f9-433f-a481-98227dfd62af';
  const tipHost = vi.fn();
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AudioRoomsController],
      providers: [
        { provide: AudioRoomsService, useValue: { tipHost } },
        {
          provide: 'PinoLogger:AudioRoomsController',
          useValue: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const httpRequest = context
            .switchToHttp()
            .getRequest<Request & { user?: { id: string } }>();
          httpRequest.user = { id: 'd8cafc67-9d30-4096-9c08-6776f3b291bd' };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['malformed route UUID', 'not-a-uuid', roomId],
    ['malformed body UUID', roomId, 'not-a-uuid'],
  ])(
    'rejects a %s before calling the service',
    async (_case, routeId, bodyId) => {
      await request(app.getHttpServer())
        .post(`/api/audio-rooms/${routeId}/tip`)
        .send({ room_id: bodyId, amount_coins: 10 })
        .expect(400);

      expect(tipHost).not.toHaveBeenCalled();
    },
  );

  it('returns only the sender wallet balance', async () => {
    tipHost.mockResolvedValue({
      tip_id: '2843941e-22ed-45c3-94aa-2ba274931893',
      amount_coins: 10,
      receiver_id: '2c84ccac-2c40-4e39-a72c-e9d28442c576',
      sender_new_balance: 70,
    });

    const response = await request(app.getHttpServer())
      .post(`/api/audio-rooms/${roomId}/tip`)
      .send({ room_id: roomId, amount_coins: 10 })
      .expect(201);

    expect(response.body).toEqual({
      tip_id: '2843941e-22ed-45c3-94aa-2ba274931893',
      amount_coins: 10,
      receiver_id: '2c84ccac-2c40-4e39-a72c-e9d28442c576',
      sender_new_balance: 70,
    });
    expect(response.body).not.toHaveProperty('receiver_new_balance');
  });
});
