import { Module } from '@nestjs/common';
<<<<<<< HEAD
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';

@Module({
  controllers: [EscrowController],
  providers: [EscrowService],
  exports: [EscrowService],
=======
import { SupabaseModule } from '../supabase/supabase.module';
import { EscrowController } from './escrow.controller';
import { EscrowExceptionFilter } from './escrow-exception.filter';
import { EscrowService } from './escrow.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { EscrowQueueWorker } from './escrow-queue.worker';

@Module({
  imports: [SupabaseModule],
  controllers: [EscrowController],
  providers: [EscrowService, CircuitBreakerService, EscrowQueueWorker],
  exports: [EscrowService, CircuitBreakerService],
>>>>>>> origin/main
})
export class EscrowModule {}
