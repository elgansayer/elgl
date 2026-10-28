import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import type { MockInstance } from 'vitest';
import { SupabaseAuthGuard } from './../src/auth/supabase-auth.guard';
import { VipGuard } from './../src/monetisation/guards/vip.guard';
import { NlpService } from './../src/nlp/nlp.service';
import { SupabaseService } from './../src/supabase/supabase.service';
import { applyE2eEnvironment, E2E_CENTRIFUGO_SECRET } from './e2e-environment';

/**
 * HTTP-level coverage for the chat room surface (issue #1691).
 *
 * The controllers, services and DTOs are the real ones, wired through the real
 * `AppModule`, and the app uses the same global `ValidationPipe` options as
 * `main.ts`. That is what proves the routes are registered and that the strict
 * pipe (`forbidNonWhitelisted`) accepts what the Angular client sends and
 * rejects everything else. Only the database, Centrifugo and authentication
 * are replaced.
 */

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const ROOM_ID = '33333333-3333-4333-8333-333333333333';
const MESSAGE_ID = '44444444-4444-4444-8444-444444444444';

interface Outcome {
  data: unknown;
  error: { message: string } | null;
}

const EMPTY: Outcome = { data: [], error: null };
const MEMBER: Outcome = { data: { user_id: USER_ID }, error: null };
const MISSING: Outcome = { data: null, error: null };

const CENTRIFUGO_API_URL = 'http://localhost:8000/api';
/** Tables a chat request may touch. Background jobs in the app touch others. */
const CHAT_TABLES = [
  'chat_room_members',
  'chat_rooms',
  'chat_messages',
  'message_receipts',
];

const QUERY_METHODS = [
  'select',
  'insert',
  'upsert',
  'update',
  'delete',
  'eq',
  'neq',
  'in',
  'lt',
  'not',
  'ilike',
  'order',
  'limit',
  'match',
  'or',
  'is',
];

interface ScriptedSingle {
  outcome: Outcome;
  /** Only answers a query that selects exactly these columns. */
  columns?: string;
}

/**
 * A table-aware stand-in for the Supabase client. Awaiting a query resolves to
 * the table's scripted list outcome. `.single()` / `.maybeSingle()` consume the
 * table's scripted single outcomes in order, skipping any scripted for other
 * columns, so app-wide work such as the last-active interceptor cannot steal an
 * outcome meant for the handler under test.
 */
function createFakeDatabase() {
  const lists = new Map<string, Outcome>();
  const singles = new Map<string, ScriptedSingle[]>();
  const created = new Map<string, Record<string, any>[]>();

  const createQuery = (table: string) => {
    const query: Record<string, any> = {};
    for (const method of QUERY_METHODS) {
      query[method] = vi.fn(() => query);
    }
    const nextSingle = (): Outcome => {
      const scripted = singles.get(table) ?? [];
      const selected = query.select.mock.calls[0]?.[0];
      const index = scripted.findIndex(
        ({ columns }) => columns === undefined || columns === selected,
      );
      return index === -1 ? MISSING : scripted.splice(index, 1)[0].outcome;
    };
    query.single = vi.fn(() => Promise.resolve(nextSingle()));
    query.maybeSingle = vi.fn(() => Promise.resolve(nextSingle()));
    query.then = (
      resolve: (value: Outcome) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(lists.get(table) ?? EMPTY).then(resolve, reject);
    return query;
  };

  const from = vi.fn((table: string) => {
    const query = createQuery(table);
    created.set(table, [...(created.get(table) ?? []), query]);
    return query;
  });

  return {
    client: {
      from,
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    list: (table: string, outcome: Outcome) => lists.set(table, outcome),
    single: (table: string, outcome: Outcome, columns?: string) =>
      singles.set(table, [...(singles.get(table) ?? []), { outcome, columns }]),
    queries: (table: string) => created.get(table) ?? [],
    reset: () => {
      lists.clear();
      singles.clear();
      created.clear();
      from.mockClear();
    },
  };
}

describe('Chat room HTTP surface (E2E)', () => {
  let app: INestApplication;
  const database = createFakeDatabase();
  let fetchSpy: MockInstance<typeof fetch>;

  /** Centrifugo publications made during the test, ignoring unrelated fetches. */
  const publishedBodies = () =>
    fetchSpy.mock.calls.flatMap(([url, init]) =>
      url === CENTRIFUGO_API_URL && typeof init?.body === 'string'
        ? [JSON.parse(init.body)]
        : [],
    );

  const expectNoChatQueries = () => {
    for (const table of CHAT_TABLES) {
      expect(database.queries(table)).toHaveLength(0);
    }
  };

  beforeAll(async () => {
    applyE2eEnvironment();
    const { AppModule } = await import('./../src/app.module');

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue({
        getClient: vi.fn().mockReturnValue(database.client),
        getRedisClient: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(null),
          set: vi.fn().mockResolvedValue('OK'),
          expire: vi.fn().mockResolvedValue(1),
          incr: vi.fn().mockResolvedValue(1),
          quit: vi.fn().mockResolvedValue('OK'),
          disconnect: vi.fn(),
        }),
        validateConfiguration: vi.fn().mockReturnValue(true),
        incrementXp: vi.fn().mockResolvedValue(undefined),
        getUserXp: vi.fn().mockResolvedValue(0),
      })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = {
            id: USER_ID,
            email: 'e2e@hellotalk.com',
          };
          return true;
        },
      })
      .overrideProvider(NlpService)
      .useValue({})
      .overrideGuard(VipGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    // Keep in step with the options in src/main.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    database.reset();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ result: {} }),
    } as Response);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('validation', () => {
    const tooMany = Array.from({ length: 101 }, () => MESSAGE_ID);

    it.each([
      [
        'read acknowledgement without ids',
        'post',
        `/chat/rooms/${ROOM_ID}/read`,
        { message_ids: [] },
      ],
      [
        'read acknowledgement with more than 100 ids',
        'post',
        `/chat/rooms/${ROOM_ID}/read`,
        { message_ids: tooMany },
      ],
      [
        'read acknowledgement naming another reader',
        'post',
        `/chat/rooms/${ROOM_ID}/read`,
        { message_ids: [MESSAGE_ID], user_id: OTHER_ID },
      ],
      [
        'typing with a non-boolean state',
        'post',
        '/chat/typing',
        { room_id: ROOM_ID, is_typing: 'maybe' },
      ],
      [
        'typing for a room that is not a UUID',
        'post',
        '/chat/typing',
        { room_id: 'room-1', is_typing: true },
      ],
      [
        'subscription token for an unknown stream',
        'post',
        '/chat/subscriptions/token',
        { room_id: ROOM_ID, stream: 'presence' },
      ],
      [
        'subscription token for a room that is not a UUID',
        'post',
        '/chat/subscriptions/token',
        { room_id: 'room-1', stream: 'messages' },
      ],
      [
        'group without a name',
        'post',
        '/chat/groups',
        { name: '   ', memberIds: [OTHER_ID] },
      ],
      [
        'group without members',
        'post',
        '/chat/groups',
        { name: 'Study group', memberIds: [] },
      ],
      [
        'group renamed to an empty name',
        'patch',
        `/chat/groups/${ROOM_ID}/rename`,
        { name: '' },
      ],
      [
        'history page larger than the maximum',
        'get',
        `/chat/messages/${ROOM_ID}?limit=101`,
        undefined,
      ],
      [
        'history page of zero messages',
        'get',
        `/chat/messages/${ROOM_ID}?limit=0`,
        undefined,
      ],
      [
        'history cursor that is not a timestamp',
        'get',
        `/chat/messages/${ROOM_ID}?before=yesterday`,
        undefined,
      ],
      [
        'room list with an invalid lock filter',
        'get',
        '/chat/rooms?include_locked=maybe',
        undefined,
      ],
    ] as const)(
      'rejects %s with 400 before touching the database',
      async (_name, method, url, body) => {
        const call = request(app.getHttpServer())[method](url);
        await (body ? call.send(body) : call).expect(400);

        expectNoChatQueries();
      },
    );

    it('still accepts the string form of the typing flag used by older clients', async () => {
      database.single('chat_room_members', MEMBER);

      await request(app.getHttpServer())
        .post('/chat/typing')
        .send({ room_id: ROOM_ID, is_typing: 'true' })
        .expect(200, { success: true });
    });
  });

  describe('channel authorisation', () => {
    it.each([
      ['messages', `chat:${ROOM_ID}`],
      ['typing', `chat:${ROOM_ID}:typing`],
    ])(
      'mints a five-minute %s token bound to the caller and one channel',
      async (stream, channel) => {
        database.single('chat_room_members', MEMBER);

        const response = await request(app.getHttpServer())
          .post('/chat/subscriptions/token')
          .send({ room_id: ROOM_ID, stream })
          .expect(201);

        const claims = jwt.verify(
          response.body.token,
          E2E_CENTRIFUGO_SECRET,
        ) as jwt.JwtPayload;
        expect(claims.sub).toBe(USER_ID);
        expect(claims.channel).toBe(channel);
        const remaining = (claims.exp ?? 0) - Math.floor(Date.now() / 1000);
        expect(remaining).toBeGreaterThan(0);
        expect(remaining).toBeLessThanOrEqual(300);
      },
    );

    it('refuses a token for a room the caller is not a member of', async () => {
      database.single('chat_room_members', MISSING);
      database.single('chat_rooms', { data: { id: ROOM_ID }, error: null });

      await request(app.getHttpServer())
        .post('/chat/subscriptions/token')
        .send({ room_id: ROOM_ID, stream: 'messages' })
        .expect(403);
    });

    it('reports an unknown room as 404 rather than 403', async () => {
      database.single('chat_room_members', MISSING);
      database.single('chat_rooms', MISSING);

      await request(app.getHttpServer())
        .post('/chat/subscriptions/token')
        .send({ room_id: ROOM_ID, stream: 'messages' })
        .expect(404);
    });

    it('reports a failed membership lookup as 503 so an outage is not mistaken for a refusal', async () => {
      database.single('chat_room_members', {
        data: null,
        error: { message: 'connection reset' },
      });

      const response = await request(app.getHttpServer())
        .post('/chat/subscriptions/token')
        .send({ room_id: ROOM_ID, stream: 'messages' })
        .expect(503);
      expect(JSON.stringify(response.body)).not.toContain('connection reset');
    });
  });

  describe('typing', () => {
    it('publishes the authenticated caller on the typing channel', async () => {
      database.single('chat_room_members', MEMBER);

      await request(app.getHttpServer())
        .post('/chat/typing')
        .send({ room_id: ROOM_ID, is_typing: true })
        .expect(200, { success: true });

      expect(publishedBodies()).toEqual([
        {
          method: 'publish',
          params: {
            channel: `chat:${ROOM_ID}:typing`,
            data: {
              userId: USER_ID,
              typing: true,
              timestamp: expect.any(Number),
            },
          },
        },
      ]);
    });

    it('does not publish for a caller outside the room', async () => {
      database.single('chat_room_members', MISSING);
      database.single('chat_rooms', { data: { id: ROOM_ID }, error: null });

      await request(app.getHttpServer())
        .post('/chat/typing')
        .send({ room_id: ROOM_ID, is_typing: true })
        .expect(403);

      expect(publishedBodies()).toEqual([]);
    });
  });

  describe('history', () => {
    const older = {
      id: 'message-1',
      room_id: ROOM_ID,
      sender_id: OTHER_ID,
      message_type: 'text',
      text_content: 'first',
      created_at: '2026-09-26T10:00:00.000Z',
    };
    const newer = {
      ...older,
      id: 'message-2',
      text_content: 'second',
      created_at: '2026-09-26T11:00:00.000Z',
    };

    it('returns one bounded page oldest first and applies the paging cursor', async () => {
      // The format PostgREST returns for a timestamptz, which the client sends back
      // as the paging cursor. Its `+` must survive query-string encoding.
      const before = '2026-09-26T12:00:00.123456+00:00';
      database.single('chat_room_members', MEMBER);
      // The database returns the newest rows first.
      database.list('chat_messages', { data: [newer, older], error: null });

      const response = await request(app.getHttpServer())
        .get(`/chat/messages/${ROOM_ID}`)
        .query({ before, limit: 2 })
        .expect(200);

      expect(
        response.body.map((message: { id: string }) => message.id),
      ).toEqual(['message-1', 'message-2']);
      const [query] = database.queries('chat_messages');
      expect(query.lt).toHaveBeenCalledWith('created_at', before);
      expect(query.limit).toHaveBeenCalledWith(2);
    });

    it('does not read a room the caller has not joined', async () => {
      database.single('chat_room_members', MISSING);
      database.single('chat_rooms', { data: { id: ROOM_ID }, error: null });

      await request(app.getHttpServer())
        .get(`/chat/messages/${ROOM_ID}`)
        .query({ before: '2026-09-26T12:00:00.000Z' })
        .expect(403);

      expect(database.queries('chat_messages')).toHaveLength(0);
    });
  });

  describe('sending', () => {
    const saved = {
      id: MESSAGE_ID,
      room_id: ROOM_ID,
      sender_id: USER_ID,
      message_type: 'text',
      text_content: 'Hello from the routed room',
      delivery_status: 'sent',
      is_read: false,
      created_at: '2026-09-26T12:00:00.000Z',
      sender: { id: USER_ID, display_name: 'Me', avatar_url: null },
    };

    it('stores the message, publishes it to the room and then marks it delivered', async () => {
      database.single('chat_room_members', MEMBER);
      database.list('chat_room_members', {
        data: [{ user_id: OTHER_ID }],
        error: null,
      });
      // First the inserted row, then the delivery check that re-reads its status.
      database.single('chat_messages', { data: saved, error: null });
      database.single(
        'chat_messages',
        { data: { delivery_status: 'sent', sender_id: USER_ID }, error: null },
        'delivery_status, sender_id',
      );
      database.list('chat_messages', {
        data: [{ id: MESSAGE_ID }],
        error: null,
      });

      const response = await request(app.getHttpServer())
        .post('/chat/messages')
        .send({
          room_id: ROOM_ID,
          message_type: 'text',
          text_content: 'Hello from the routed room',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: MESSAGE_ID,
        room_id: ROOM_ID,
        delivery_status: 'sent',
      });
      // The delivered tick is published after the response, so wait for it.
      await vi.waitFor(() => expect(publishedBodies()).toHaveLength(2));
      expect(publishedBodies()).toEqual([
        {
          method: 'publish',
          params: { channel: `chat:${ROOM_ID}`, data: { message: saved } },
        },
        {
          method: 'publish',
          params: {
            channel: `chat:${ROOM_ID}`,
            data: {
              status_update: {
                message_id: MESSAGE_ID,
                delivery_status: 'delivered',
              },
            },
          },
        },
      ]);
    });

    it('does not store or publish a message from someone outside the room', async () => {
      database.single('chat_room_members', MISSING);
      database.single('chat_rooms', { data: { id: ROOM_ID }, error: null });

      await request(app.getHttpServer())
        .post('/chat/messages')
        .send({ room_id: ROOM_ID, message_type: 'text', text_content: 'Hi' })
        .expect(403);

      expect(database.queries('chat_messages')).toHaveLength(0);
      expect(publishedBodies()).toEqual([]);
    });
  });

  describe('read acknowledgements', () => {
    const unread = {
      id: MESSAGE_ID,
      sender_id: OTHER_ID,
      delivery_status: 'delivered',
    };

    const arrangeReceiptFlow = (readReceipts: boolean) => {
      database.single('chat_room_members', MEMBER);
      database.single(
        'users',
        { data: { chat_preferences: { readReceipts } }, error: null },
        'chat_preferences',
      );
      database.list('chat_messages', { data: [unread], error: null });
      database.list('chat_room_members', {
        data: [{ user_id: USER_ID }, { user_id: OTHER_ID }],
        error: null,
      });
      database.list('message_receipts', {
        data: [{ message_id: MESSAGE_ID, user_id: USER_ID }],
        error: null,
      });
    };

    it('records the read and tells the room once every recipient has read it', async () => {
      arrangeReceiptFlow(true);

      await request(app.getHttpServer())
        .post(`/chat/rooms/${ROOM_ID}/read`)
        .send({ message_ids: [MESSAGE_ID] })
        .expect(200, { success: true, marked: 1 });

      expect(publishedBodies()).toEqual([
        {
          method: 'publish',
          params: {
            channel: `chat:${ROOM_ID}`,
            data: {
              status_update: {
                message_id: MESSAGE_ID,
                delivery_status: 'read',
              },
            },
          },
        },
      ]);
    });

    it('discloses nothing for a reader who has not turned read receipts on', async () => {
      arrangeReceiptFlow(false);

      await request(app.getHttpServer())
        .post(`/chat/rooms/${ROOM_ID}/read`)
        .send({ message_ids: [MESSAGE_ID] })
        .expect(200, { success: true, marked: 0 });

      expect(database.queries('message_receipts')).toHaveLength(0);
      expect(publishedBodies()).toEqual([]);
    });

    it('refuses an acknowledgement from outside the room', async () => {
      database.single('chat_room_members', MISSING);
      database.single('chat_rooms', { data: { id: ROOM_ID }, error: null });

      await request(app.getHttpServer())
        .post(`/chat/rooms/${ROOM_ID}/read`)
        .send({ message_ids: [MESSAGE_ID] })
        .expect(403);
    });

    it('keeps the legacy status route working for older clients', async () => {
      database.single('chat_room_members', MEMBER);
      database.single('chat_messages', {
        data: {
          id: MESSAGE_ID,
          room_id: ROOM_ID,
          sender_id: OTHER_ID,
          delivery_status: 'sent',
        },
        error: null,
      });
      database.list('chat_messages', {
        data: [{ id: MESSAGE_ID }],
        error: null,
      });

      await request(app.getHttpServer())
        .patch(`/chat/messages/${MESSAGE_ID}/status`)
        .send({ status: 'delivered' })
        .expect(200, { success: true });

      expect(publishedBodies()).toEqual([
        {
          method: 'publish',
          params: {
            channel: `chat:${ROOM_ID}`,
            data: {
              status_update: {
                message_id: MESSAGE_ID,
                delivery_status: 'delivered',
              },
            },
          },
        },
      ]);
    });

    it('lets only the sender see who has read a message', async () => {
      database.single('chat_messages', {
        data: {
          id: MESSAGE_ID,
          room_id: ROOM_ID,
          sender_id: OTHER_ID,
          delivery_status: 'delivered',
        },
        error: null,
      });
      database.single('chat_room_members', MEMBER);

      await request(app.getHttpServer())
        .get(`/chat/messages/${MESSAGE_ID}/receipts`)
        .expect(403);

      expect(database.queries('message_receipts')).toHaveLength(0);
    });
  });

  describe('room list', () => {
    const memberships = [
      { room_id: 'room-a', is_locked: false },
      { room_id: 'room-b', is_locked: true },
    ];
    const rooms = [
      { id: 'room-a', title: 'Practice partners', admin_id: null },
      { id: 'room-b', title: 'Private study', admin_id: USER_ID },
    ];

    it('lists only the rooms the caller belongs to and hides locked ones by default', async () => {
      database.list('chat_room_members', { data: memberships, error: null });
      database.list('chat_rooms', { data: rooms, error: null });

      const response = await request(app.getHttpServer())
        .get('/chat/rooms')
        .expect(200);

      expect(response.body.map((room: { id: string }) => room.id)).toEqual([
        'room-a',
      ]);
      const [roomQuery] = database.queries('chat_rooms');
      expect(roomQuery.in).toHaveBeenCalledWith('id', ['room-a', 'room-b']);
    });

    it('includes locked rooms, flagged, when the routed room asks for them', async () => {
      database.list('chat_room_members', { data: memberships, error: null });
      database.list('chat_rooms', { data: rooms, error: null });

      const response = await request(app.getHttpServer())
        .get('/chat/rooms')
        .query({ include_locked: 'true' })
        .expect(200);

      expect(
        response.body.map((room: { id: string; is_locked: boolean }) => [
          room.id,
          room.is_locked,
        ]),
      ).toEqual([
        ['room-a', false],
        ['room-b', true],
      ]);
    });

    it('fails with 503 instead of returning an incomplete or invented list', async () => {
      database.list('chat_room_members', {
        data: null,
        error: { message: 'timeout' },
      });

      await request(app.getHttpServer()).get('/chat/rooms').expect(503);
    });
  });

  describe('groups', () => {
    it('lists participants to a member and honours a hidden VIP status', async () => {
      database.single('chat_room_members', MEMBER);
      database.list('chat_room_members', {
        data: [
          {
            user_id: OTHER_ID,
            user: {
              id: OTHER_ID,
              display_name: 'Aiko',
              avatar_url: null,
              native_languages: ['ja'],
              target_languages: ['en'],
              is_vip: true,
              privacy_hide_vip_status: true,
            },
          },
        ],
        error: null,
      });

      const response = await request(app.getHttpServer())
        .get(`/chat/groups/${ROOM_ID}/members`)
        .expect(200);

      expect(response.body).toEqual([
        {
          user_id: OTHER_ID,
          user: {
            id: OTHER_ID,
            display_name: 'Aiko',
            avatar_url: null,
            native_language: 'ja',
            target_languages: ['en'],
            is_vip: false,
          },
        },
      ]);
    });

    it('does not list participants to someone outside the group', async () => {
      database.single('chat_room_members', MISSING);
      database.single('chat_rooms', { data: { id: ROOM_ID }, error: null });

      await request(app.getHttpServer())
        .get(`/chat/groups/${ROOM_ID}/members`)
        .expect(403);
    });

    it('creates a group administered by the caller with a trimmed name', async () => {
      database.single('chat_rooms', {
        data: { id: ROOM_ID, title: 'Study group', admin_id: USER_ID },
        error: null,
      });

      await request(app.getHttpServer())
        .post('/chat/groups')
        .send({ name: '  Study group  ', memberIds: [OTHER_ID] })
        .expect(201, { id: ROOM_ID, title: 'Study group', admin_id: USER_ID });

      const [roomQuery] = database.queries('chat_rooms');
      expect(roomQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Study group', admin_id: USER_ID }),
      );
      const [memberQuery] = database.queries('chat_room_members');
      expect(memberQuery.insert).toHaveBeenCalledWith([
        { room_id: ROOM_ID, user_id: USER_ID },
        { room_id: ROOM_ID, user_id: OTHER_ID },
      ]);
    });

    it('only lets the group admin rename the group', async () => {
      database.single('chat_rooms', {
        data: { admin_id: OTHER_ID },
        error: null,
      });

      await request(app.getHttpServer())
        .patch(`/chat/groups/${ROOM_ID}/rename`)
        .send({ name: 'Renamed' })
        .expect(403);
    });

    it('refuses to remove the admin from their own group', async () => {
      database.single('chat_rooms', {
        data: { admin_id: USER_ID },
        error: null,
      });

      await request(app.getHttpServer())
        .delete(`/chat/groups/${ROOM_ID}/members/${USER_ID}`)
        .expect(400);
    });
  });
});
