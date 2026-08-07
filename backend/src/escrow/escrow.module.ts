import { Module } from '@nestjs/common';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
import { MonetisationModule } from '../monetisation/monetisation.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [MonetisationModule, SupabaseModule],
  controllers: [EscrowController],
  providers: [EscrowService],
  exports: [EscrowService],
})
export class EscrowModule {}