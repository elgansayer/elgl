import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { NlpController } from './nlp.controller';
import { NlpService } from './nlp.service';
import { NlpRateLimiterGuard } from './nlp-rate-limiter.guard';

@Module({
  imports: [UsersModule],
  controllers: [NlpController],
  providers: [NlpService, NlpRateLimiterGuard],
  exports: [NlpService],
})
export class NlpModule {}
