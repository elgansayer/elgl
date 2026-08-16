import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { LlmProxyModule } from '../llm-proxy/llm-proxy.module';
import { NlpController } from './nlp.controller';
import { NlpService } from './nlp.service';
import { NlpRateLimiterGuard } from './nlp-rate-limiter.guard';
import { NlpWorkerService } from './nlp-worker.service';
import { FlashcardsModule } from '../flashcards/flashcards.module';

@Module({
  imports: [UsersModule, LlmProxyModule, FlashcardsModule],
  controllers: [NlpController],
  providers: [NlpService, NlpRateLimiterGuard, NlpWorkerService],
  exports: [NlpService, NlpWorkerService],
})
export class NlpModule {}
