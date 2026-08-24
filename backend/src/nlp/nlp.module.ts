import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { LlmProxyModule } from '../llm-proxy/llm-proxy.module';
import { GrammarCheckService } from './grammar-check.service';
import { GrammarExplanationService } from './grammar-explanation.service';
import { NlpController } from './nlp.controller';
import { NlpService } from './nlp.service';
import { NlpRateLimiterGuard } from './nlp-rate-limiter.guard';
import { PronunciationScoringService } from './pronunciation-scoring.service';

@Module({
  imports: [UsersModule, LlmProxyModule],
  controllers: [NlpController],
  providers: [
    NlpService,
    GrammarCheckService,
    GrammarExplanationService,
    PronunciationScoringService,
    NlpRateLimiterGuard,
  ],
  exports: [NlpService],
})
export class NlpModule {}