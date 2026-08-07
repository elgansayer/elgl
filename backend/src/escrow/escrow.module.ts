import { Module } from '@nestjs/common';
<<<<<<< HEAD
<<<<<<< HEAD
import { SupabaseModule } from '../supabase/supabase.module';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';

@Module({
  imports: [SupabaseModule],
=======
=======
import { SupabaseModule } from '../supabase/supabase.module';
>>>>>>> origin/main
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { EscrowQueueWorker } from './escrow-queue.worker';

@Module({
<<<<<<< HEAD
  imports: [MonetisationModule, SupabaseModule],
>>>>>>> origin/main
=======
  imports: [SupabaseModule],
>>>>>>> origin/main
  controllers: [EscrowController],
  providers: [EscrowService, CircuitBreakerService, EscrowQueueWorker],
  exports: [EscrowService, CircuitBreakerService],
})
export class EscrowModule {}
