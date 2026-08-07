import { Module } from '@nestjs/common';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
import { GdprDataScrubbingService } from './gdpr-data-scrubbing.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [EscrowController],
  providers: [EscrowService, GdprDataScrubbingService],
  exports: [EscrowService, GdprDataScrubbingService],
})
export class EscrowModule {}
