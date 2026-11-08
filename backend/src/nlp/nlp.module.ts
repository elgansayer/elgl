import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { LlmProxyModule } from '../llm-proxy/llm-proxy.module';
import { GrammarCheckService } from './grammar-check.service';
import { GrammarExplanationService } from './grammar-explanation.service';
import { NlpController } from './nlp.controller';
import { NlpService } from './nlp.service';
import { NlpRateLimiterGuard } from './nlp-rate-limiter.guard';
import { TranslationRouterService } from './translation-router.service';
import { PronunciationScoringService } from './pronunciation-scoring.service';
import { SpeechTranscriptionService } from './speech-transcription.service';

@Module({
  imports: [UsersModule, LlmProxyModule],
  controllers: [NlpController],
  providers: [
    NlpService,
    GrammarCheckService,
    GrammarExplanationService,
    PronunciationScoringService,
    SpeechTranscriptionService,
    NlpRateLimiterGuard,
    TranslationRouterService,
  ],
  exports: [NlpService, SpeechTranscriptionService, TranslationRouterService],
})
export class NlpModule {}
