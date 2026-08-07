import { Module } from '@nestjs/common';
import { AudioRoomsModule } from '../audio-rooms/audio-rooms.module';
import { UsersModule } from '../users/users.module';
import { SafetyModule } from '../safety/safety.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { DiscoveryRateLimiterGuard } from './discovery-rate-limiter.guard';
import { MatchmakingCacheInvalidationService } from './matchmaking-cache-invalidation.service';

@Module({
  imports: [AudioRoomsModule, UsersModule, SafetyModule, SupabaseModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService, DiscoveryRateLimiterGuard, MatchmakingCacheInvalidationService],
  exports: [DiscoveryService, MatchmakingCacheInvalidationService],
})
export class DiscoveryModule {}
