import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { ChatMediaMessageService } from './chat-media-message.service';
import { ChatMediaSendController } from './chat-media-send.controller';

describe('POST /media/chat/send over HTTP', () => {
  let app: INestApplication;
  const send = vi.fn();
  const getUser = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    send.mockResolvedValue({
      id: 'message-1',
      room_id: '11111111-1111-4111-8111-111111111111',
      sender_id: 'user-1',
      message_type: 'doodle',
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [ChatMediaSendController],
      providers: [
        SupabaseAuthGuard,
        { provide: ChatMediaMessageService, useValue: { send } },
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ auth: { getUser } }) },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const validBody = {
    roomId: '11111111-1111-4111-8111-111111111111',
    mediaKind: 'doodle',
    objectKey:
      'chat-media/user-1/doodle/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.png',
  };

  it('authenticates, validates, and dispatches a doodle as the token user', async () => {
    const response = await request(app.getHttpServer())
      .post('/media/chat/send')
      .set('Authorization', 'Bearer valid-token')
      .send(validBody);

    expect(response.status).toBe(201);
    expect(getUser).toHaveBeenCalledWith('valid-token');
    expect(send).toHaveBeenCalledWith('user-1', validBody);
  });

  it('rejects unauthenticated requests before dispatch', async () => {
    const response = await request(app.getHttpServer())
      .post('/media/chat/send')
      .send(validBody);

    expect(response.status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ['an invalid room id', { ...validBody, roomId: 'not-a-uuid' }],
    [
      'a non-doodle extension',
      { ...validBody, objectKey: validBody.objectKey.replace('.png', '.jpg') },
    ],
    ['an unknown property', { ...validBody, senderId: 'attacker' }],
  ])(
    'rejects %s through the production validation pipe',
    async (_name, body) => {
      const response = await request(app.getHttpServer())
        .post('/media/chat/send')
        .set('Authorization', 'Bearer valid-token')
        .send(body);

      expect(response.status).toBe(400);
      expect(send).not.toHaveBeenCalled();
    },
  );
});
