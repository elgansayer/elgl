import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { EscrowController } from './escrow.controller';
import { EscrowExceptionFilter } from './escrow-exception.filter';
import { EscrowService } from './escrow.service';
<<<<<<< HEAD
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
=======
import { CircuitBreakerService } from './circuit-breaker.service';
import { EscrowQueueWorker } from './escrow-queue.worker';
>>>>>>> origin/main

@Module({
  imports: [SupabaseModule],
  controllers: [EscrowController],
  providers: [EscrowService, CircuitBreakerService, EscrowQueueWorker],
  exports: [EscrowService, CircuitBreakerService],
})
export class EscrowModule {}
<<<<<<< HEAD
>>>>>>> origin/main
=======
>>>>>>> origin/main
