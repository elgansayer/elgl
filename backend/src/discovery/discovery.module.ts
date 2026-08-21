import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AudioRoomsModule } from '../audio-rooms/audio-rooms.module';
import { UsersModule } from '../users/users.module';
import { SafetyModule } from '../safety/safety.module';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { DiscoveryRateLimiterGuard } from './discovery-rate-limiter.guard';
import { SupabaseModule } from '../supabase/supabase.module';
import { DiscoveryDegradationService } from './discovery-degradation.service';
import { CorrectorScoreModule } from '../corrector-score/corrector-score.module';
import { DiscoveryCacheInvalidationService } from './discovery-cache-invalidation.service';
import { NearbySearchIntegrityInterceptor } from './nearby-search-integrity.interceptor';

@Module({
  imports: [
    AudioRoomsModule,
    UsersModule,
    SafetyModule,
    SupabaseModule,
    CorrectorScoreModule,
  ],
  controllers: [DiscoveryController],
  providers: [
    DiscoveryService,
    DiscoveryRateLimiterGuard,
    DiscoveryDegradationService,
    DiscoveryCacheInvalidationService,
    {
      provide: APP_INTERCEPTOR,
      useClass: NearbySearchIntegrityInterceptor,
    },
  ],
  exports: [DiscoveryService, DiscoveryDegradationService],
})
export class DiscoveryModule {}
