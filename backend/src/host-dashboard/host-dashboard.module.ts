import { Module } from '@nestjs/common';
import { HostDashboardController } from './host-dashboard.controller';
import { HostDashboardService } from './host-dashboard.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [HostDashboardController],
  providers: [HostDashboardService],
})
export class HostDashboardModule {}
