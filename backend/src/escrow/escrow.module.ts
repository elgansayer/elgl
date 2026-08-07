import { Module } from '@nestjs/common';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
import { EscrowRateLimiterGuard } from './escrow-rate-limiter.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [EscrowController],
  providers: [EscrowService, EscrowRateLimiterGuard],
  exports: [EscrowService],
})
export class EscrowModule {}
