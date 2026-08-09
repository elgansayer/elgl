import { Module } from '@nestjs/common';
import { SharedLoggerModule } from '../common/logger/logger.module';
import { CircuitBreakerService } from '../escrow/circuit-breaker.service';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsRateLimiterGuard } from './recommendations-rate-limiter.guard';
import { MatchmakingCrashReportService } from './matchmaking-crash-report.service';

@Module({
  imports: [SharedLoggerModule],
  controllers: [RecommendationsController],
  providers: [
    RecommendationsService,
    RecommendationsRateLimiterGuard,
    CircuitBreakerService,
    MatchmakingCrashReportService,
  ],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
