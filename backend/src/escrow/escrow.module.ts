import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
<<<<<<< HEAD
import { RetryModule } from '../common/retry/retry.module';

@Module({
  imports: [MonetisationModule, SupabaseModule, RetryModule],
=======
import { EscrowController } from './escrow.controller';
import { EscrowExceptionFilter } from './escrow-exception.filter';
import { EscrowService } from './escrow.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { EscrowQueueWorker } from './escrow-queue.worker';

@Module({
  imports: [SupabaseModule],
>>>>>>> origin/main
  controllers: [EscrowController],
  providers: [EscrowService, CircuitBreakerService, EscrowQueueWorker],
  exports: [EscrowService, CircuitBreakerService],
})
export class EscrowModule {}
