import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { MetricsModule } from '../metrics/metrics.module';
import { EconomyController } from './economy.controller';
import { EconomyService } from './economy.service';
import { CoinEconomyHealthService } from './coin-economy-health.service';
import { EconomyExceptionFilter } from './economy-exception.filter';
import { EconomyRateLimiterGuard } from './economy-rate-limiter.guard';

@Module({
  imports: [UsersModule, ChatModule, HttpModule, MetricsModule],
  controllers: [EconomyController],
  providers: [
    EconomyService,
    CoinEconomyHealthService,
    EconomyRateLimiterGuard,
    EconomyExceptionFilter,
  ],
  exports: [EconomyService, CoinEconomyHealthService],
})
export class EconomyModule {}
