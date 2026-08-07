import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
<<<<<<< HEAD
import { EscrowRateLimiterGuard } from './escrow-rate-limiter.guard';
import { UsersModule } from '../users/users.module';
=======
import { CircuitBreakerService } from './circuit-breaker.service';
import { EscrowQueueWorker } from './escrow-queue.worker';
>>>>>>> origin/main

@Module({
  imports: [SupabaseModule],
  controllers: [EscrowController],
<<<<<<< HEAD
  providers: [EscrowService, EscrowRateLimiterGuard],
  exports: [EscrowService],
=======
  providers: [EscrowService, CircuitBreakerService, EscrowQueueWorker],
  exports: [EscrowService, CircuitBreakerService],
>>>>>>> origin/main
})
export class EscrowModule {}
