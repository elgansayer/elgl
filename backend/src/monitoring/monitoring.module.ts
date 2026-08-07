import { Module, Global } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { MetricsModule } from '../metrics/metrics.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Global()
@Module({
  imports: [MetricsModule, SupabaseModule],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}