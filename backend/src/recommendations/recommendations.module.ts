import { Module } from '@nestjs/common';
import { SharedLoggerModule } from '../common/logger/logger.module';
import { CircuitBreakerService } from '../escrow/circuit-breaker.service';
import { MetricsModule } from '../metrics/metrics.module';
import { SafetyModule } from '../safety/safety.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { DiscoveryRecommendationsService } from './discovery-recommendations.service';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsRateLimiterGuard } from './recommendations-rate-limiter.guard';
import { MatchmakingCrashReportService } from './matchmaking-crash-report.service';

@Module({
  // SupabaseModule and MetricsModule are global in the application, but declaring
  // them here keeps RecommendationsModule's runtime dependencies explicit. This
  // is especially important for the scheduled daily recommendation job, which is
  // instantiated outside an HTTP request lifecycle.
  imports: [SharedLoggerModule, SupabaseModule, MetricsModule, SafetyModule],
  controllers: [RecommendationsController],
  providers: [
    RecommendationsService,
    DiscoveryRecommendationsService,
    RecommendationsRateLimiterGuard,
    CircuitBreakerService,
    MatchmakingCrashReportService,
  ],
  exports: [RecommendationsService, DiscoveryRecommendationsService],
})
export class RecommendationsModule {}
