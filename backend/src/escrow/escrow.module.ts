import { Module } from '@nestjs/common';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
import { MonetisationModule } from '../monetisation/monetisation.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { RetryModule } from '../common/retry/retry.module';

@Module({
  imports: [MonetisationModule, SupabaseModule, RetryModule],
  controllers: [EscrowController],
  providers: [EscrowService],
  exports: [EscrowService],
})
export class EscrowModule {}
