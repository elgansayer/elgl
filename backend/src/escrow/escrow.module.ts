import { Module } from '@nestjs/common';
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
})
export class EscrowModule {}
