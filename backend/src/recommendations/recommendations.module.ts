import { Module } from '@nestjs/common';
<<<<<<< HEAD
import { SharedLoggerModule } from '../common/logger/logger.module';
=======
import { EscrowModule } from '../escrow/escrow.module';
import { MatchmakingCrashReportService } from './matchmaking-crash-report.service';
import { MatchmakingExceptionFilter } from './matchmaking-exception.filter';
>>>>>>> origin/main
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsRateLimiterGuard } from './recommendations-rate-limiter.guard';

@Module({
<<<<<<< HEAD
  imports: [SharedLoggerModule],
=======
  imports: [EscrowModule],
>>>>>>> origin/main
  controllers: [RecommendationsController],
  providers: [
    RecommendationsService,
    MatchmakingCrashReportService,
    MatchmakingExceptionFilter,
    RecommendationsRateLimiterGuard,
  ],
  exports: [RecommendationsService, MatchmakingCrashReportService],
})
export class RecommendationsModule {}
