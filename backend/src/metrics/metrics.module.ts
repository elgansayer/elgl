import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MetricsInterceptor } from './metrics.interceptor';
import { SrsMetricsAggregator } from './srs-metrics.aggregator';
<<<<<<< HEAD
import { EscrowMetricsAggregator } from './escrow-metrics.aggregator';
=======
import { TrustSafetyMetricsAggregator } from './ts-metrics.aggregator';
>>>>>>> origin/main

@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    SrsMetricsAggregator,
<<<<<<< HEAD
    EscrowMetricsAggregator,
=======
    TrustSafetyMetricsAggregator,
>>>>>>> origin/main
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
