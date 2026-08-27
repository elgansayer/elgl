import { Module } from '@nestjs/common';
import { DailyTipService } from './daily-tip.service';
import { DailyTipController } from './daily-tip.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { LlmProxyModule } from '../llm-proxy/llm-proxy.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SupabaseModule, LlmProxyModule, AuthModule],
  controllers: [DailyTipController],
  providers: [DailyTipService],
  exports: [DailyTipService],
})
export class DailyTipModule {}
