import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AccountSuspensionService } from '../account-suspension/account-suspension.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ADMIN_CAPABILITIES_METADATA_KEY } from './decorators/require-admin-capabilities.decorator';
import { AdminFlaggedMomentsService } from './admin-flagged-moments.service';
import { AdminModerationV1Controller } from './admin-moderation-v1.controller';
import { AdminCapabilityGuard } from './guards/admin-capability.guard';
import { AdminGuard } from './guards/admin.guard';

const USER = '11111111-1111-4111-8111-111111111111';
const REPORT = '66666666-6666-4666-8666-666666666666';
const SUSPENSION = '44444444-4444-4444-8444-444444444444';
const KEY = '33333333-3333-4333-8333-333333333333';

describe('AdminModerationV1Controller', () => {
  const flaggedMoments = {
    list: vi.fn(),
    resolve: vi.fn(),
    suspendUser: vi.fn(),
  };
  const suspensions = { lift: vi.fn() };
  let controller: AdminModerationV1Controller;

  beforeEach(() => {
    vi.resetAllMocks();
    controller = new AdminModerationV1Controller(
      flaggedMoments as unknown as AdminFlaggedMomentsService,
      suspensions as unknown as AccountSuspensionService,
    );
  });

  it('authenticates, requires an admin and enforces capabilities on every route', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminModerationV1Controller),
    ).toEqual([SupabaseAuthGuard, AdminGuard, AdminCapabilityGuard]);
  });

  it.each([
    ['list', 'moderation.cases.read'],
    ['resolve', 'moderation.cases.manage'],
    ['suspend', 'moderation.cases.manage'],
    ['lift', 'moderation.cases.manage'],
  ] as const)('requires %s to hold %s', (handler, capability) => {
    expect(
      Reflect.getMetadata(
        ADMIN_CAPABILITIES_METADATA_KEY,
        AdminModerationV1Controller.prototype[handler],
      ),
    ).toEqual([capability]);
  });

  it('delegates listing with the validated query', async () => {
    flaggedMoments.list.mockResolvedValue({ items: [] });
    const query = { page: 2, pageSize: 10, status: 'pending' as const };

    await controller.list(query);

    expect(flaggedMoments.list).toHaveBeenCalledWith(query);
  });

  it('delegates a decision for the identified report', async () => {
    flaggedMoments.resolve.mockResolvedValue({ replayed: false });

    await controller.resolve(REPORT, {
      decision: 'uphold',
      reasonCode: 'policy_violation',
    });

    expect(flaggedMoments.resolve).toHaveBeenCalledWith(REPORT, 'uphold');
  });

  it('suspends on behalf of the authenticated operator, never a body-supplied one', async () => {
    flaggedMoments.suspendUser.mockResolvedValue({ replayed: false });
    const dto = {
      expiresAt: '2026-11-16T10:00:00.000Z',
      reasonCode: 'policy_violation' as const,
      idempotencyKey: KEY,
    };

    await controller.suspend(USER, dto, { user: { sub: 'operator' } } as never);

    expect(flaggedMoments.suspendUser).toHaveBeenCalledWith(
      'operator',
      USER,
      dto,
    );
  });

  it('lifts on behalf of the authenticated operator', async () => {
    suspensions.lift.mockResolvedValue({ replayed: false });

    await controller.lift(
      SUSPENSION,
      { reasonCode: 'support_correction', operatorNote: 'mistaken' },
      { user: { id: 'operator' } } as never,
    );

    expect(suspensions.lift).toHaveBeenCalledWith({
      actorUserId: 'operator',
      suspensionId: SUSPENSION,
      reasonCode: 'support_correction',
      operatorNote: 'mistaken',
    });
  });

  it('refuses a request that carries no operator identity', () => {
    expect(() =>
      controller.lift(SUSPENSION, { reasonCode: 'support_correction' }, {
        user: {},
      } as never),
    ).toThrow(UnauthorizedException);
    expect(suspensions.lift).not.toHaveBeenCalled();
  });
});
