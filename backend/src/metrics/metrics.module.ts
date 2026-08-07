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

@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    SrsMetricsAggregator,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
>>>>>>> origin/main
  exports: [MetricsService],
})
export class MetricsModule {}
