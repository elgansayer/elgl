import {
  Controller,
  Get,
  Global,
  INestApplication,
  Module,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountSuspensionModule } from '../src/account-suspension/account-suspension.module';
import { SupabaseAuthGuard } from '../src/auth/supabase-auth.guard';
import { MetricsService } from '../src/metrics/metrics.service';
import { SupabaseService } from '../src/supabase/supabase.service';

@Controller('probe')
@UseGuards(SupabaseAuthGuard)
class ProbeController {
  @Get()
  read() {
    return { ok: true };
  }
}

/**
 * Boots the real guard, the real AccountSuspensionService and the real global
 * module wiring. Only the Supabase transport and metrics sink are replaced.
 */
describe('Account suspension enforcement E2E', () => {
  let app: INestApplication;
  let activeRow: { id: string; expires_at: string } | null;
  let lookupFails: boolean;
  const recordAccountSuspensionCheckFailure = vi.fn();

  const suspensionQuery = () => {
    const result = lookupFails
      ? { data: null, error: { message: 'down' } }
      : { data: activeRow, error: null };
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'is', 'gt', 'order', 'limit']) {
      builder[method] = () => builder;
    }
    builder.maybeSingle = () => Promise.resolve(result);
    return builder;
  };

  beforeEach(async () => {
    activeRow = null;
    lookupFails = false;
    recordAccountSuspensionCheckFailure.mockReset();

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'member-1' } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table !== 'account_suspensions')
          throw new Error(`unexpected ${table}`);
        return suspensionQuery();
      }),
    };

    // Mirrors production, where these come from the @Global SupabaseModule and MetricsModule.
    @Global()
    @Module({
      providers: [
        { provide: SupabaseService, useValue: { getClient: () => client } },
        {
          provide: MetricsService,
          useValue: {
            recordAccountSuspensionAction: vi.fn(),
            recordAccountSuspensionCheckFailure,
          },
        },
      ],
      exports: [SupabaseService, MetricsService],
    })
    class InfrastructureModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [InfrastructureModule, AccountSuspensionModule],
      controllers: [ProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('serves a member with no active suspension', async () => {
    await request(app.getHttpServer())
      .get('/probe')
      .set('Authorization', 'Bearer token')
      .expect(200);
  });

  it('refuses a suspended member with only the end time and a stable code', async () => {
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    activeRow = { id: 'suspension-1', expires_at: expiresAt };

    const response = await request(app.getHttpServer())
      .get('/probe')
      .set('Authorization', 'Bearer token')
      .expect(403);

    expect(response.body).toEqual({
      statusCode: 403,
      error: 'Forbidden',
      code: 'ACCOUNT_SUSPENDED',
      message: 'This account is temporarily suspended.',
      suspendedUntil: expiresAt,
    });
  });

  it('fails open and counts the failure when the suspension lookup is unavailable', async () => {
    lookupFails = true;

    await request(app.getHttpServer())
      .get('/probe')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(recordAccountSuspensionCheckFailure).toHaveBeenCalledTimes(1);
  });

  it('still rejects a request with no credentials before any suspension lookup', async () => {
    await request(app.getHttpServer()).get('/probe').expect(401);
  });
});
