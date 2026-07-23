import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MonetisationController } from './monetisation.controller';
import { MonetisationService } from './monetisation.service';
import { AppleReceiptValidatorService } from './apple-receipt-validator.service';
import { AppleNotificationService } from './apple-notification.service';
import { AppleNotificationController } from './apple-notification.controller';
import { GooglePlayNotificationService } from './google-play-notification.service';
import { GooglePlayNotificationController } from './google-play-notification.controller';
import { SubscriptionPlansController } from './controllers/subscription-plans.controller';
import { SubscriptionPlansService } from './services/subscription-plans.service';

@Module({
  imports: [HttpModule],
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
