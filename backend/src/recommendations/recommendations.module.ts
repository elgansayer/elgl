import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsRateLimiterGuard } from './recommendations-rate-limiter.guard';
import { MatchmakingCrashReportService } from './matchmaking-crash-report.service';
import { EscrowModule } from '../escrow/escrow.module';

@Module({
  imports: [EscrowModule],
  controllers: [RecommendationsController],
  providers: [
    RecommendationsService,
    RecommendationsRateLimiterGuard,
    MatchmakingCrashReportService,
  ],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
