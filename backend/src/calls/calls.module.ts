import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';

@Module({
  imports: [SupabaseModule],
  controllers: [CallsController],
  providers: [CallsService],
})
export class CallsModule {}
