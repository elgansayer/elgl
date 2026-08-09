import { Module } from '@nestjs/common';
import { StreakService } from './streak.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [StreakService],
  exports: [StreakService],
})
export class StreakModule {}
