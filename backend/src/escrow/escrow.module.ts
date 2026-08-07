import { Module } from '@nestjs/common';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
<<<<<<< HEAD
import { GdprDataScrubbingService } from './gdpr-data-scrubbing.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [EscrowController],
  providers: [EscrowService, GdprDataScrubbingService],
  exports: [EscrowService, GdprDataScrubbingService],
})
export class EscrowModule {}
=======
import { MonetisationModule } from '../monetisation/monetisation.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [MonetisationModule, SupabaseModule],
  controllers: [EscrowController],
  providers: [EscrowService],
  exports: [EscrowService],
})
export class EscrowModule {}
>>>>>>> origin/main
