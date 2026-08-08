import { Module } from '@nestjs/common';
import { SharedLoggerModule } from '../common/logger/logger.module';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsRateLimiterGuard } from './recommendations-rate-limiter.guard';

@Module({
  imports: [SharedLoggerModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, RecommendationsRateLimiterGuard],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
