import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MetricsInterceptor } from './metrics.interceptor';
import { DatadogMetricsService } from './datadog-metrics.service';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    DatadogMetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
  exports: [MetricsService, DatadogMetricsService],
})
export class MetricsModule {}
