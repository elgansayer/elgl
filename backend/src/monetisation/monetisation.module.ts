import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MonetisationController } from './monetisation.controller';
import { MonetisationService } from './monetisation.service';
import { AppleReceiptValidatorService } from './apple-receipt-validator.service';
import { AppleNotificationService } from './apple-notification.service';
import { AppleNotificationController } from './apple-notification.controller';
import { GooglePlayNotificationService } from './google-play-notification.service';
import { GooglePlayNotificationController } from './google-play-notification.controller';

@Module({
  imports: [HttpModule],
  controllers: [
    MonetisationController,
    AppleNotificationController,
    GooglePlayNotificationController,
  ],
  providers: [
    MonetisationService,
    AppleReceiptValidatorService,
    AppleNotificationService,
    GooglePlayNotificationService,
  ],
  exports: [
    MonetisationService,
    AppleReceiptValidatorService,
    AppleNotificationService,
    GooglePlayNotificationService,
  ],
})
export class MonetisationModule {}
