import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { StreakService } from './streak.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [ScheduleModule.forRoot(), SupabaseModule],
  providers: [StreakService],
  exports: [StreakService],
})
export class StreakModule {}
