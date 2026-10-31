import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../../supabase/supabase.service';

export const VIP_TIER_METADATA = 'require_vip_tier';
export type VipRequirement = 'consumer' | 'pro' | 'developer' | 'any';

@Injectable()
export class VipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredTier = this.reflector.getAllAndOverride<VipRequirement>(
      VIP_TIER_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredTier) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { id?: string };
    }>();
    const user = request.user;
    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('is_vip, vip_tier')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      throw new ForbiddenException('VIP subscription could not be verified');
    }

    const isVip = Boolean(data.is_vip);
    const tier = (data.vip_tier as string | null) ?? '';
    const tierMatches =
      isVip &&
      (requiredTier === 'any' ||
        requiredTier === 'consumer' ||
        (requiredTier === 'pro' &&
          (tier.startsWith('pro') || tier.startsWith('developer'))) ||
        (requiredTier === 'developer' && tier.startsWith('developer')));

    if (!tierMatches) {
      const tierLabel =
        requiredTier === 'developer'
          ? 'Developer'
          : requiredTier === 'pro'
            ? 'Pro'
            : 'VIP';
      throw new ForbiddenException(
        `Access requires ${tierLabel} subscription plan`,
      );
    }

    return true;
  }
}
