import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { SharedLoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [SupabaseModule, SharedLoggerModule],
  controllers: [CallsController],
  providers: [CallsService],
})
export class CallsModule {}
