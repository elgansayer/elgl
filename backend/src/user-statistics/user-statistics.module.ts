import { Module } from '@nestjs/common';
import { UserStatisticsController } from './user-statistics.controller';
import { UserStatisticsService } from './user-statistics.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [UserStatisticsController],
  providers: [UserStatisticsService],
  exports: [UserStatisticsService],
})
export class UserStatisticsModule {}
