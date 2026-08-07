import { Module } from '@nestjs/common';
import { SharedLoggerModule } from '../common/logger/logger.module';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [SharedLoggerModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
