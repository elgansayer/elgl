import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { StreakService } from './streak.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    ScheduleModule.forRoot(),
    SupabaseModule,
  ],
  providers: [StreakService],
  exports: [StreakService],
})
export class StreakModule {}
