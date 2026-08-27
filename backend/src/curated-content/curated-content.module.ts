import { Module } from '@nestjs/common';
import { CuratedContentController } from './curated-content.controller';
import { CuratedContentService } from './curated-content.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [CuratedContentController],
  providers: [CuratedContentService],
  exports: [CuratedContentService],
})
export class CuratedContentModule {}
