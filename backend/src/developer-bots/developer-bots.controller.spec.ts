import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { VIP_TIER_METADATA, VipGuard } from '../monetisation/guards/vip.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { DeveloperBotsController } from './developer-bots.controller';
import { DeveloperBotsService } from './developer-bots.service';

describe('DeveloperBotsController', () => {
  const user = { id: 'user-1' } as never;
  const bot = {
    id: '11111111-1111-4111-8111-111111111111',
    owner_id: 'user-1',
    display_name: 'Chef Ana',
    persona: 'A cheerful Spanish chef',
    target_language: 'es',
    tone: 'playful',
    greeting: 'Hola',
    is_enabled: true,
    created_at: '2026-11-14T00:00:00.000Z',
    updated_at: '2026-11-14T00:00:00.000Z',
  };
  const service = {
    listBots: vi.fn().mockResolvedValue([bot]),
    createBot: vi.fn().mockResolvedValue(bot),
    updateBot: vi.fn().mockResolvedValue(bot),
    deleteBot: vi.fn().mockResolvedValue(undefined),
  };
  const controller = new DeveloperBotsController(
    service as unknown as DeveloperBotsService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is guarded by authentication and the developer VIP tier', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, DeveloperBotsController),
    ).toEqual([SupabaseAuthGuard, VipGuard]);
    expect(
      Reflect.getMetadata(VIP_TIER_METADATA, DeveloperBotsController),
    ).toBe('developer');
  });

  it('rejects unauthenticated access', () => {
    expect(() => controller.list(null)).toThrow(UnauthorizedException);
  });

  it('delegates every operation with the authenticated owner id', async () => {
    await expect(controller.list(user)).resolves.toEqual([bot]);
    await controller.create(user, {
      display_name: 'Chef Ana',
      persona: 'A cheerful Spanish chef',
      target_language: 'es',
      tone: 'playful',
    });
    await controller.update(user, bot.id, { display_name: 'Chef Ana 2' });
    await controller.remove(user, bot.id);

    expect(service.listBots).toHaveBeenCalledWith('user-1');
    expect(service.createBot).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ display_name: 'Chef Ana' }),
    );
    expect(service.updateBot).toHaveBeenCalledWith(bot.id, 'user-1', {
      display_name: 'Chef Ana 2',
    });
    expect(service.deleteBot).toHaveBeenCalledWith(bot.id, 'user-1');
  });
});

describe('VipGuard developer tier enforcement', () => {
  const contextFor = (userId: string) =>
    ({
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: userId } }),
      }),
    }) as unknown as ExecutionContext;

  const guardWith = (profile: { is_vip: boolean; vip_tier: string }) =>
    new VipGuard(
      {
        getAllAndOverride: () => 'developer',
      } as unknown as Reflector,
      {
        getClient: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: profile, error: null }),
              }),
            }),
          }),
        }),
      } as unknown as SupabaseService,
    );

  it('refuses a free tier caller', async () => {
    const guard = guardWith({ is_vip: false, vip_tier: 'free' });

    await expect(
      guard.canActivate(contextFor('free-user')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a consumer tier caller', async () => {
    const guard = guardWith({ is_vip: true, vip_tier: 'consumer' });

    await expect(
      guard.canActivate(contextFor('consumer-user')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a developer tier caller', async () => {
    const guard = guardWith({ is_vip: true, vip_tier: 'developer' });

    await expect(guard.canActivate(contextFor('dev-user'))).resolves.toBe(true);
  });
});
