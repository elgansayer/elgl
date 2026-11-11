import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_CAPABILITIES_METADATA_KEY } from '../admin/decorators/require-admin-capabilities.decorator';
import { AdminCapabilityGuard } from '../admin/guards/admin-capability.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AdminDmcaV1Controller } from './admin-dmca-v1.controller';
import { DmcaOperatorService } from './dmca-operator.service';
import { AdminDmcaDecisionDto } from './dto/admin-dmca.dto';

const NOTICE_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

describe('AdminDmcaV1Controller', () => {
  const service = { list: vi.fn(), get: vi.fn(), decide: vi.fn() };
  let controller: AdminDmcaV1Controller;
  const decision = Object.assign(new AdminDmcaDecisionDto(), {
    decision: 'reject',
    reasonCode: 'legal_request',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AdminDmcaV1Controller(
      service as unknown as DmcaOperatorService,
    );
  });

  it('passes the operator identity to the decision, from either token claim', async () => {
    service.decide.mockResolvedValue({ id: NOTICE_ID });

    await controller.decide(NOTICE_ID, decision, {
      user: { id: 'op-1' },
    } as never);
    await controller.decide(NOTICE_ID, decision, {
      user: { sub: 'op-2' },
    } as never);

    expect(service.decide).toHaveBeenNthCalledWith(
      1,
      NOTICE_ID,
      'op-1',
      decision,
    );
    expect(service.decide).toHaveBeenNthCalledWith(
      2,
      NOTICE_ID,
      'op-2',
      decision,
    );
  });

  it('refuses a decision when no operator identity is present', async () => {
    await expect(
      controller.decide(NOTICE_ID, decision, { user: {} } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.decide).not.toHaveBeenCalled();
  });

  it('delegates listing and detail', async () => {
    await controller.list({ status: 'needs_review' });
    await controller.get(NOTICE_ID);

    expect(service.list).toHaveBeenCalledWith({ status: 'needs_review' });
    expect(service.get).toHaveBeenCalledWith(NOTICE_ID);
  });

  describe('authorisation', () => {
    const reflector = new Reflector();

    it('sits under /admin so every request is written to the admin audit log', () => {
      expect(Reflect.getMetadata('path', AdminDmcaV1Controller)).toBe(
        'admin/v1/dmca/notices',
      );
    });

    it('requires authentication, admin status and a capability on every route', () => {
      expect(Reflect.getMetadata('__guards__', AdminDmcaV1Controller)).toEqual([
        SupabaseAuthGuard,
        AdminGuard,
        AdminCapabilityGuard,
      ]);
    });

    it.each([
      ['list', 'moderation.cases.read'],
      ['get', 'moderation.cases.read'],
      ['decide', 'moderation.cases.manage'],
    ] as const)('%s needs %s', (handler, capability) => {
      expect(
        reflector.get<string[]>(
          ADMIN_CAPABILITIES_METADATA_KEY,
          AdminDmcaV1Controller.prototype[handler],
        ),
      ).toEqual([capability]);
    });
  });
});
