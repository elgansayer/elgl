import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MonetisationController } from './monetisation.controller';
import { MonetisationService } from './monetisation.service';
import { AppleReceiptValidatorService } from './apple-receipt-validator.service';

@Module({
  imports: [HttpModule],
  controllers: [
    MonetisationController,
  ],
  providers: [
    MonetisationService,
    AppleReceiptValidatorService,
  ],
  exports: [
    MonetisationService,
    AppleReceiptValidatorService,
  ],
})
export class MonetisationModule {}
