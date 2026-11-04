import {
  INestApplication,
  ServiceUnavailableException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { SupabaseAuthGuard } from '../src/auth/supabase-auth.guard';
import { ChatSearchController } from '../src/chat/chat-search.controller';
import { ChatService } from '../src/chat/chat.service';

describe('Chat message search E2E', () => {
  let app: INestApplication;
  const searchAllMessages = vi.fn();

  beforeEach(async () => {
    searchAllMessages.mockReset();
    searchAllMessages.mockResolvedValue([]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      // Mirrors AppModule: a global default limit that the route overrides.
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
      controllers: [ChatSearchController],
      providers: [
        { provide: ChatService, useValue: { searchAllMessages } },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: vi.fn((context) => {
          const request = context.switchToHttp().getRequest();
          if (!request.headers.authorization) {
            throw new UnauthorizedException('Missing authentication token');
          }
          request.user = { id: 'user-1' };
          return true;
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    // Same options as src/main.ts.
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

  const search = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/chat/search')
      .set('Authorization', 'Bearer token')
      .send(body);

  it('returns membership-scoped results uncached, with trimmed and typed input', async () => {
    const results = [{ id: 'message-1', room_id: 'room-1' }];
    searchAllMessages.mockResolvedValue(results);

    const response = await search({
      term: '  hello world  ',
      roomId: ' room-1 ',
      limit: '25',
    }).expect(201);

    expect(response.body).toEqual(results);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(searchAllMessages).toHaveBeenCalledWith(
      'user-1',
      'hello world',
      25,
      'room-1',
    );
  });

  it('searches every joined chat with a bounded default limit when no room is named', async () => {
    await search({ term: 'bonjour' }).expect(201);

    expect(searchAllMessages).toHaveBeenCalledWith(
      'user-1',
      'bonjour',
      50,
      undefined,
    );
  });

  it('requires authentication before any search is attempted', async () => {
    await request(app.getHttpServer())
      .post('/chat/search')
      .send({ term: 'hello' })
      .expect(401);

    expect(searchAllMessages).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing term', {}],
    ['a one character term', { term: 'x' }],
    ['an over-long term', { term: 'x'.repeat(201) }],
    ['a blank room id', { term: 'hello', roomId: '   ' }],
    ['a zero limit', { term: 'hello', limit: 0 }],
    ['an unbounded limit', { term: 'hello', limit: 101 }],
    ['a non-numeric limit', { term: 'hello', limit: 'many' }],
    [
      'a caller-supplied user identifier',
      { term: 'hello', userId: 'someone-else' },
    ],
  ])('rejects %s without searching', async (_label, body) => {
    await search(body).expect(400);

    expect(searchAllMessages).not.toHaveBeenCalled();
  });

  it('keeps the private search term out of the URL', async () => {
    await request(app.getHttpServer())
      .get('/chat/search')
      .query({ term: 'hello' })
      .set('Authorization', 'Bearer token')
      .expect(404);

    expect(searchAllMessages).not.toHaveBeenCalled();
  });

  it('reports a provider outage as a sanitised 503 that never echoes the search', async () => {
    searchAllMessages.mockRejectedValue(new ServiceUnavailableException());

    const response = await search({
      term: 'secret diagnosis',
      roomId: 'room-1',
    }).expect(503);

    expect(JSON.stringify(response.body)).not.toContain('secret diagnosis');
    expect(JSON.stringify(response.body)).not.toContain('room-1');
  });

  it('rate limits search to 30 requests per minute', async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await search({ term: 'hello' }).expect(201);
    }

    await search({ term: 'hello' }).expect(429);
    expect(searchAllMessages).toHaveBeenCalledTimes(30);
  });
});
