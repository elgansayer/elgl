import { SetMetadata } from '@nestjs/common';
import { VIP_TIER_METADATA } from '../guards/vip.guard';

export const RequireVip = (tier: 'consumer' | 'developer' | 'any') =>
  SetMetadata(VIP_TIER_METADATA, tier);
