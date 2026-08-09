<<<<<<< HEAD
import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
=======
import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MetricsInterceptor } from './metrics.interceptor';
import { SrsMetricsAggregator } from './srs-metrics.aggregator';
import { TrustSafetyMetricsAggregator } from './ts-metrics.aggregator';
import { EscrowMetricsAggregator } from './escrow-metrics.aggregator';
import { RecommendationsMetricsAggregator } from './recommendations-metrics.aggregator';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    SrsMetricsAggregator,
    TrustSafetyMetricsAggregator,
    EscrowMetricsAggregator,
    RecommendationsMetricsAggregator,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
>>>>>>> origin/main
  exports: [MetricsService],
})
export class MetricsModule {}
