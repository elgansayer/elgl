import { Module } from '@nestjs/common';
<<<<<<< HEAD
import { SupabaseModule } from '../supabase/supabase.module';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';

@Module({
  imports: [SupabaseModule],
=======
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
import { MonetisationModule } from '../monetisation/monetisation.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [MonetisationModule, SupabaseModule],
>>>>>>> origin/main
  controllers: [EscrowController],
  providers: [EscrowService],
  exports: [EscrowService],
})
export class EscrowModule {}