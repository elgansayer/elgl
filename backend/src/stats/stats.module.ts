import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [SupabaseModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
