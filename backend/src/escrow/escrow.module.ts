import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
<<<<<<< HEAD
import { UsersModule } from '../users/users.module';
import { AdminModule } from '../admin/admin.module';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';

@Module({
  imports: [SupabaseModule, UsersModule, AdminModule],
  controllers: [EscrowController],
  providers: [EscrowService],
  exports: [EscrowService],
})
export class EscrowModule {}
=======
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
>>>>>>> origin/main
