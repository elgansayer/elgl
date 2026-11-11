import { Module } from '@nestjs/common';
import { AchievementsModule } from '../achievements/achievements.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { PerformanceReportService } from './performance-report.service';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [SupabaseModule, AchievementsModule],
  controllers: [StatsController],
  providers: [StatsService, PerformanceReportService],
})
export class StatsModule {}
