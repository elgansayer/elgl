import { Module } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { AchievementsController } from './achievements.controller';
import { SupabaseService } from '../supabase/supabase.service';

@Module({
  controllers: [AchievementsController],
  providers: [AchievementsService, SupabaseService],
  exports: [AchievementsService],
})
export class AchievementsModule {}
