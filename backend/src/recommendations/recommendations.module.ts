import { Module } from '@nestjs/common';
import { EscrowModule } from '../escrow/escrow.module';
import { MatchmakingCrashReportService } from './matchmaking-crash-report.service';
import { MatchmakingExceptionFilter } from './matchmaking-exception.filter';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [EscrowModule],
  controllers: [RecommendationsController],
  providers: [
    RecommendationsService,
    MatchmakingCrashReportService,
    MatchmakingExceptionFilter,
  ],
  exports: [RecommendationsService, MatchmakingCrashReportService],
})
export class RecommendationsModule {}
