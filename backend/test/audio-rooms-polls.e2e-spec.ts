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

describe('Quick Poll API', () => {
  const createPoll = vi.fn();
  const getActivePoll = vi.fn();
  const getPollResults = vi.fn();
  const submitVote = vi.fn();
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AudioRoomsController],
      providers: [
        {
          provide: AudioRoomsService,
          useValue: { createPoll, getActivePoll, getPollResults, submitVote },
        },
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
          httpRequest.user = { id: 'host-1' };
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

  it('creates a validated poll for the authenticated host', async () => {
    createPoll.mockResolvedValue({
      poll_id: '92f7dd4a-afb6-4a9c-9bc4-6ead58ac0f47',
    });

    await request(app.getHttpServer())
      .post('/api/audio-rooms/63eedbd6-03f9-433f-a481-98227dfd62af/polls')
      .send({ question: 'Next topic?', options: ['Travel', 'Food'] })
      .expect(201)
      .expect({ poll_id: '92f7dd4a-afb6-4a9c-9bc4-6ead58ac0f47' });

    expect(createPoll).toHaveBeenCalledWith(
      'host-1',
      '63eedbd6-03f9-433f-a481-98227dfd62af',
      { question: 'Next topic?', options: ['Travel', 'Food'] },
    );
  });

  it('rejects a poll with fewer than two options before calling the service', async () => {
    await request(app.getHttpServer())
      .post('/api/audio-rooms/63eedbd6-03f9-433f-a481-98227dfd62af/polls')
      .send({ question: 'Next topic?', options: ['Travel'] })
      .expect(400);

    expect(createPoll).not.toHaveBeenCalled();
  });

  it('returns the recoverable active poll contract', async () => {
    const poll = {
      poll_id: '92f7dd4a-afb6-4a9c-9bc4-6ead58ac0f47',
      question: 'Next topic?',
      options: ['Travel', 'Food'],
      votes: [2, 1],
      totalVotes: 3,
      is_active: true,
      userVote: 0,
    };
    getActivePoll.mockResolvedValue(poll);

    await request(app.getHttpServer())
      .get('/api/audio-rooms/63eedbd6-03f9-433f-a481-98227dfd62af/polls/active')
      .expect(200)
      .expect(poll);

    expect(getActivePoll).toHaveBeenCalledWith(
      'host-1',
      '63eedbd6-03f9-433f-a481-98227dfd62af',
    );
  });
});
