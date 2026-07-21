import { Module } from '@nestjs/common';
import { MonetisationController } from './monetisation.controller';
import { MonetisationService } from './monetisation.service';

@Module({
  controllers: [MonetisationController],
  providers: [MonetisationService],
  exports: [MonetisationService],
})
export class MonetisationModule {}
