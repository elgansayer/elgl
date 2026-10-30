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
import { UiDictionaryTranslationService } from './ui-dictionary-translation.service';

@Module({
  imports: [UsersModule, LlmProxyModule],
  controllers: [NlpController],
  providers: [
    NlpService,
    GrammarCheckService,
    GrammarExplanationService,
    PronunciationScoringService,
    NlpRateLimiterGuard,
    TranslationRouterService,
    UiDictionaryTranslationService,
  ],
  exports: [NlpService, TranslationRouterService],
})
export class NlpModule {}
