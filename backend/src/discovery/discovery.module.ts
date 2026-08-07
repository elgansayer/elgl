import { Module } from '@nestjs/common';
import { AudioRoomsModule } from '../audio-rooms/audio-rooms.module';
import { UsersModule } from '../users/users.module';
import { SafetyModule } from '../safety/safety.module';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { DiscoveryCacheInvalidationService } from './discovery-cache-invalidation.service';
import { DiscoveryRateLimiterGuard } from './discovery-rate-limiter.guard';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [AudioRoomsModule, UsersModule, SafetyModule, SupabaseModule],
  controllers: [DiscoveryController],
  providers: [
    DiscoveryService,
    DiscoveryCacheInvalidationService,
    DiscoveryRateLimiterGuard,
  ],
  exports: [DiscoveryService, DiscoveryCacheInvalidationService],
})
export class DiscoveryModule {}
