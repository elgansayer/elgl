import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../../supabase/supabase.service';
import { VIP_TIER_METADATA, VipGuard, type VipRequirement } from './vip.guard';

function buildContext(user?: { id: string }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => function handler() {},
    getClass: () => class TestController {},
  } as unknown as ExecutionContext;
}

describe('VipGuard', () => {
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let single: ReturnType<typeof vi.fn>;
  let eq: ReturnType<typeof vi.fn>;
  let select: ReturnType<typeof vi.fn>;
  let from: ReturnType<typeof vi.fn>;
  let supabaseService: { getClient: ReturnType<typeof vi.fn> };
  let guard: VipGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn() };
    single = vi.fn();
    eq = vi.fn().mockReturnValue({ single });
    select = vi.fn().mockReturnValue({ eq });
    from = vi.fn().mockReturnValue({ select });
    supabaseService = {
      getClient: vi.fn().mockReturnValue({ from }),
    };
    guard = new VipGuard(
      reflector as unknown as Reflector,
      supabaseService as unknown as SupabaseService,
    );
  });

  function requireTier(tier: VipRequirement | undefined): void {
    reflector.getAllAndOverride.mockReturnValue(tier);
  }

  function mockEntitlement(
    data: { is_vip: boolean; vip_tier: string | null } | null,
    error: unknown = null,
  ): void {
    single.mockResolvedValue({ data, error });
  }

  it('allows routes without VIP metadata without querying entitlement state', async () => {
    requireTier(undefined);

    await expect(
      guard.canActivate(buildContext({ id: 'user-1' })),
    ).resolves.toBe(true);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      VIP_TIER_METADATA,
      expect.any(Array),
    );
    expect(supabaseService.getClient).not.toHaveBeenCalled();
  });

  it('rejects VIP routes without an authenticated user', async () => {
    requireTier('consumer');

    await expect(guard.canActivate(buildContext())).rejects.toThrow(
      ForbiddenException,
    );
    expect(supabaseService.getClient).not.toHaveBeenCalled();
  });

  it('rejects free users for the generic any-VIP requirement', async () => {
    requireTier('any');
    mockEntitlement({ is_vip: false, vip_tier: 'free' });

    await expect(
      guard.canActivate(buildContext({ id: 'free-user' })),
    ).rejects.toThrow('Access requires VIP subscription plan');
  });

  it('accepts an entitled user for the generic any-VIP requirement', async () => {
    requireTier('any');
    mockEntitlement({ is_vip: true, vip_tier: 'consumer' });

    await expect(
      guard.canActivate(buildContext({ id: 'vip-user' })),
    ).resolves.toBe(true);
  });

  it('requires is_vip for consumer access regardless of the stored tier label', async () => {
    requireTier('consumer');
    mockEntitlement({ is_vip: false, vip_tier: 'consumer' });

    await expect(
      guard.canActivate(buildContext({ id: 'stale-consumer' })),
    ).rejects.toThrow(ForbiddenException);

    mockEntitlement({ is_vip: true, vip_tier: 'developer' });
    await expect(
      guard.canActivate(buildContext({ id: 'developer-user' })),
    ).resolves.toBe(true);
  });

  it('requires both is_vip and a developer tier for developer access', async () => {
    requireTier('developer');

    mockEntitlement({ is_vip: true, vip_tier: 'consumer' });
    await expect(
      guard.canActivate(buildContext({ id: 'consumer-user' })),
    ).rejects.toThrow('Access requires Developer subscription plan');

    mockEntitlement({ is_vip: false, vip_tier: 'developer_monthly' });
    await expect(
      guard.canActivate(buildContext({ id: 'expired-developer' })),
    ).rejects.toThrow(ForbiddenException);

    mockEntitlement({ is_vip: true, vip_tier: 'developer_monthly' });
    await expect(
      guard.canActivate(buildContext({ id: 'developer-user' })),
    ).resolves.toBe(true);
  });

  it.each([
    ['lookup error', null, { message: 'provider unavailable' }],
    ['missing entitlement row', null, null],
  ])('fails closed on %s', async (_label, data, error) => {
    requireTier('any');
    mockEntitlement(data, error);

    await expect(
      guard.canActivate(buildContext({ id: 'user-1' })),
    ).rejects.toThrow('VIP subscription could not be verified');
  });

  it('fails closed for unknown runtime metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue('enterprise');
    mockEntitlement({ is_vip: true, vip_tier: 'developer' });

    await expect(
      guard.canActivate(buildContext({ id: 'vip-user' })),
    ).rejects.toThrow(ForbiddenException);
  });
});
