import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SharedLoggerModule } from '../common/logger/logger.module';
import { MonetisationController } from './monetisation.controller';
import { MonetisationService } from './monetisation.service';
import { AppleReceiptValidatorService } from './apple-receipt-validator.service';
import { AppleNotificationService } from './apple-notification.service';
import { AppleNotificationController } from './apple-notification.controller';
import { GooglePlayNotificationService } from './google-play-notification.service';
import { GooglePlayNotificationController } from './google-play-notification.controller';
import { SubscriptionPlansController } from './controllers/subscription-plans.controller';
import { SubscriptionPlansService } from './services/subscription-plans.service';
import { VipGuard } from './guards/vip.guard';
import { DeveloperApiKeyGuard } from './guards/developer-api-key.guard';
import { DeveloperApiUsageInterceptor } from './interceptors/developer-api-usage.interceptor';

@Module({
  imports: [HttpModule, SharedLoggerModule],
  controllers: [
    MonetisationController,
    AppleNotificationController,
    GooglePlayNotificationController,
    SubscriptionPlansController,
  ],
  providers: [
    MonetisationService,
    AppleReceiptValidatorService,
    AppleNotificationService,
    GooglePlayNotificationService,
    SubscriptionPlansService,
    VipGuard,
    DeveloperApiKeyGuard,
    DeveloperApiUsageInterceptor,
  ],
  exports: [
    MonetisationService,
    AppleReceiptValidatorService,
    AppleNotificationService,
    GooglePlayNotificationService,
    SubscriptionPlansService,
  ],
})
export class MonetisationModule {}
