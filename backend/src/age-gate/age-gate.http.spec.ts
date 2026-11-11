import {
  Controller,
  Get,
  INestApplication,
  Logger,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { AgeGateController } from './age-gate.controller';
import { AgeGateService } from './age-gate.service';
import { AgeGateStatusService } from './age-gate-status.service';

@Controller('gated')
@UseGuards(SupabaseAuthGuard)
class GatedController {
  @Get()
  read(): { ok: true } {
    return { ok: true };
  }
}

interface UserRow {
  age_gate_status: string;
  date_of_birth: string | null;
  age: number | null;
  is_deletion_pending: boolean;
}

/** An in-memory `users` table that honours the compare-and-set filters. */
function createWorld() {
  const users = new Map<string, UserRow>();
  const lockouts = new Map<string, string>();
  const events: unknown[] = [];
  const bans: string[] = [];

  const usersQuery = () => {
    let operation = 'select';
    let payload: Partial<UserRow> & { id?: string } = {};
    let id = '';
    let allowed: string[] | null = null;
    const run = (): { data: unknown; error: null } => {
      const row = users.get(id);
      if (operation === 'select') {
        return {
          data: row ? { age_gate_status: row.age_gate_status } : null,
          error: null,
        };
      }
      if (operation === 'upsert') {
        if (payload.id && !users.has(payload.id)) {
          users.set(payload.id, {
            age_gate_status: 'required',
            date_of_birth: null,
            age: null,
            is_deletion_pending: false,
          });
        }
        return { data: null, error: null };
      }
      if (
        operation === 'update' &&
        row &&
        (!allowed || allowed.includes(row.age_gate_status))
      ) {
        Object.assign(row, payload);
        return { data: [{ id }], error: null };
      }
      return { data: [], error: null };
    };
    const query: Record<string, unknown> = {
      select: () => query,
      update: (value: Partial<UserRow>) => {
        operation = 'update';
        payload = value;
        return query;
      },
      upsert: (value: { id: string }) => {
        operation = 'upsert';
        payload = value;
        return query;
      },
      eq: (_column: string, value: string) => {
        id = value;
        return query;
      },
      in: (_column: string, values: string[]) => {
        allowed = values;
        return query;
      },
      maybeSingle: () => Promise.resolve(run()),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve),
    };
    return query;
  };

  const lockoutQuery = () => {
    let hash = '';
    let operation = 'select';
    const query: Record<string, unknown> = {
      select: () => query,
      eq: (_column: string, value: string) => {
        hash = value;
        return query;
      },
      gt: () => query,
      upsert: (row: { identifier_hash: string; locked_until: string }) => {
        operation = 'upsert';
        lockouts.set(row.identifier_hash, row.locked_until);
        return query;
      },
      maybeSingle: () =>
        Promise.resolve({
          data: lockouts.has(hash)
            ? { locked_until: lockouts.get(hash) }
            : null,
          error: null,
        }),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({
          data: operation === 'upsert' ? null : [],
          error: null,
        }).then(resolve),
    };
    return query;
  };

  const tokens: Record<string, { id: string; email: string }> = {
    'adult-token': { id: 'adult-1', email: 'adult@example.com' },
    'child-token': { id: 'child-1', email: 'child@example.com' },
    'fresh-token': { id: 'fresh-1', email: 'fresh@example.com' },
  };

  const client = {
    from: (table: string) => {
      if (table === 'users') return usersQuery();
      if (table === 'age_gate_lockouts') return lockoutQuery();
      return {
        insert: (row: unknown) => {
          events.push(row);
          return Promise.resolve({ error: null });
        },
      };
    },
    auth: {
      getUser: (token: string) =>
        Promise.resolve(
          tokens[token]
            ? { data: { user: tokens[token] }, error: null }
            : { data: { user: null }, error: { message: 'invalid' } },
        ),
      admin: {
        updateUserById: (userId: string) => {
          bans.push(userId);
          return Promise.resolve({ error: null });
        },
      },
    },
  };

  return { users, lockouts, events, bans, client };
}

describe('age gate over HTTP', () => {
  let app: INestApplication;
  let world: ReturnType<typeof createWorld>;

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    world = createWorld();
    world.users.set('adult-1', {
      age_gate_status: 'required',
      date_of_birth: null,
      age: null,
      is_deletion_pending: false,
    });
    world.users.set('child-1', {
      age_gate_status: 'required',
      date_of_birth: null,
      age: null,
      is_deletion_pending: false,
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [AgeGateController, GatedController],
      providers: [
        AgeGateService,
        AgeGateStatusService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => world.client },
        },
        {
          provide: ConfigService,
          useValue: { get: () => 'service-role-secret' },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
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
    vi.restoreAllMocks();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('rejects an unauthenticated caller before any age logic runs', async () => {
    await http().get('/api/gated').expect(401);
    await http().get('/api/age-gate/status').expect(401);
    await http()
      .post('/api/age-gate')
      .send({ dateOfBirth: '1990-01-01' })
      .expect(401);
  });

  it('keeps an account that has not declared a date of birth out of every other route', async () => {
    const response = await http()
      .get('/api/gated')
      .set(bearer('adult-token'))
      .expect(403);

    expect(response.body).toMatchObject({
      statusCode: 403,
      code: 'AGE_GATE_REQUIRED',
    });
  });

  it('still lets that account read its state and never reveals the threshold', async () => {
    const response = await http()
      .get('/api/age-gate/status')
      .set(bearer('adult-token'))
      .expect(200);

    expect(response.body).toEqual({
      status: 'required',
      required: true,
      blocked: false,
    });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(response.body)).not.toMatch(/13|minimum/i);
  });

  it('validates the body with the same pipe the application uses', async () => {
    const send = (body: object) =>
      http().post('/api/age-gate').set(bearer('adult-token')).send(body);

    await send({}).expect(400);
    await send({ dateOfBirth: '23/04/1990' }).expect(400);
    await send({ dateOfBirth: '1990-04-23', passed: true }).expect(400);
    const impossible = await send({ dateOfBirth: '2999-01-01' }).expect(400);
    expect(impossible.body.code).toBe('INVALID_DATE_OF_BIRTH');
    expect(world.users.get('adult-1')?.age_gate_status).toBe('required');
  });

  it('opens the rest of the API once an adult declares a date of birth', async () => {
    const response = await http()
      .post('/api/age-gate')
      .set(bearer('adult-token'))
      .send({ dateOfBirth: '1990-04-23' })
      .expect(200);

    expect(response.body).toEqual({
      status: 'passed',
      required: false,
      blocked: false,
    });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(world.users.get('adult-1')).toMatchObject({
      age_gate_status: 'passed',
      date_of_birth: '1990-04-23',
    });
    await http()
      .get('/api/gated')
      .set(bearer('adult-token'))
      .expect(200, { ok: true });
  });

  it('blocks a child, keeps the date out of storage and responses, and refuses a retry with an older date', async () => {
    const first = await http()
      .post('/api/age-gate')
      .set(bearer('child-token'))
      .send({ dateOfBirth: '2018-03-04' })
      .expect(200);

    expect(first.body).toEqual({
      status: 'blocked_under_age',
      required: false,
      blocked: true,
    });
    expect(world.users.get('child-1')).toMatchObject({
      age_gate_status: 'blocked_under_age',
      date_of_birth: null,
      is_deletion_pending: true,
    });
    expect(world.bans).toEqual(['child-1']);
    expect(
      JSON.stringify([
        ...world.users.values(),
        world.events,
        [...world.lockouts],
      ]),
    ).not.toContain('2018');
    expect(world.lockouts.size).toBe(1);
    expect([...world.lockouts.keys()][0]).toMatch(/^[0-9a-f]{64}$/);

    const blocked = await http()
      .get('/api/gated')
      .set(bearer('child-token'))
      .expect(403);
    expect(blocked.body.code).toBe('AGE_GATE_BLOCKED');

    const retry = await http()
      .post('/api/age-gate')
      .set(bearer('child-token'))
      .send({ dateOfBirth: '1990-01-01' })
      .expect(200);
    expect(retry.body.status).toBe('blocked_under_age');
    await http().get('/api/gated').set(bearer('child-token')).expect(403);
  });

  it('blocks a brand-new account whose profile row does not exist yet', async () => {
    const response = await http()
      .get('/api/gated')
      .set(bearer('fresh-token'))
      .expect(403);
    expect(response.body.code).toBe('AGE_GATE_REQUIRED');

    await http()
      .post('/api/age-gate')
      .set(bearer('fresh-token'))
      .send({ dateOfBirth: '1990-04-23' })
      .expect(200);
    expect(world.users.get('fresh-1')?.age_gate_status).toBe('passed');
  });
});
