import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MonetisationController } from './monetisation.controller';
import { MonetisationService } from './monetisation.service';
import { AppleNotificationsController } from './apple-notifications.controller';
import { AppleNotificationsService } from './apple-notifications.service';
import { AppleReceiptValidatorService } from './apple-receipt-validator.service';

@Module({
  imports: [HttpModule],
  controllers: [
    MonetisationController,
    AppleNotificationsController,
  ],
  providers: [
    MonetisationService,
    AppleNotificationsService,
    AppleReceiptValidatorService,
  ],
  exports: [
    MonetisationService,
    AppleNotificationsService,
    AppleReceiptValidatorService,
  ],
})
export class MonetisationModule {}
