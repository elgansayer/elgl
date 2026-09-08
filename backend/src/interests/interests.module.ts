import { Module } from '@nestjs/common';
import { InterestsService } from './interests.service';
import { InterestsController } from './interests.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { LlmProxyModule } from '../llm-proxy/llm-proxy.module';

@Module({
  imports: [SupabaseModule, LlmProxyModule],
  controllers: [InterestsController],
  providers: [InterestsService],
  exports: [InterestsService],
})
export class InterestsModule {}
