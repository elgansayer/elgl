import { Module } from '@nestjs/common';
import { StudyStreakController } from './study-streak.controller';
import { StudyStreakService } from './study-streak.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [StudyStreakController],
  providers: [StudyStreakService],
  exports: [StudyStreakService],
})
export class StudyStreakModule {}
