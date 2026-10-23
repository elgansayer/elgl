import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { LlmProxyModule } from '../llm-proxy/llm-proxy.module';
import { NlpController } from './nlp.controller';
import { NlpService } from './nlp.service';
import { NlpRateLimiterGuard } from './nlp-rate-limiter.guard';
import { PronunciationScoringService } from './pronunciation-scoring.service';

@Module({
  imports: [UsersModule, LlmProxyModule],
  controllers: [NlpController],
  providers: [NlpService, NlpRateLimiterGuard],
  exports: [NlpService],
})
export class NlpModule {}
