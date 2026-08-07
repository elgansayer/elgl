import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MetricsInterceptor } from './metrics.interceptor';
import { SrsMetricsAggregator } from './srs-metrics.aggregator';
import { ModerationMetricsAggregator } from './moderation-metrics.aggregator';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    SrsMetricsAggregator,
    ModerationMetricsAggregator,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
