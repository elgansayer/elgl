import { SetMetadata } from '@nestjs/common';
import { VIP_TIER_METADATA, type VipRequirement } from '../guards/vip.guard';

export const RequireVip = (tier: VipRequirement) =>
  SetMetadata(VIP_TIER_METADATA, tier);
