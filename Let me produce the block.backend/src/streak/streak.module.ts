import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { StreakService } from './streak.service';

@Module({
  imports: [SupabaseModule],
  providers: [StreakService],
  exports: [StreakService],
})
export class StreakModule {}
