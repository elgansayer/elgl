import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { MetricsModule } from '../metrics/metrics.module';
import { LlmProxyModule } from '../llm-proxy/llm-proxy.module';
import { EconomyController } from './economy.controller';
import { PremiumAiController } from './premium-ai.controller';
import { EconomyService } from './economy.service';
import { PremiumAiService } from './premium-ai.service';
import { PremiumAiReconciliationService } from './premium-ai-reconciliation.service';
import { CoinEconomyHealthService } from './coin-economy-health.service';
import { EconomyExceptionFilter } from './economy-exception.filter';
import { EconomyRateLimiterGuard } from './economy-rate-limiter.guard';

@Module({
  imports: [
    UsersModule,
    ChatModule,
    HttpModule,
    MetricsModule,
    LlmProxyModule,
  ],
  controllers: [EconomyController, PremiumAiController],
  providers: [
    EconomyService,
    PremiumAiService,
    PremiumAiReconciliationService,
    CoinEconomyHealthService,
    EconomyRateLimiterGuard,
    EconomyExceptionFilter,
  ],
  exports: [EconomyService, PremiumAiService, CoinEconomyHealthService],
})
export class EconomyModule {}
