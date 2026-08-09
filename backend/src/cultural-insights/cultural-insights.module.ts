import { Module } from '@nestjs/common';
import { CulturalInsightsController } from './cultural-insights.controller';
import { CulturalInsightsService } from './cultural-insights.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [CulturalInsightsController],
  providers: [CulturalInsightsService],
  exports: [CulturalInsightsService],
})
export class CulturalInsightsModule {}
