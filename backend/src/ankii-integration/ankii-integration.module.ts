import { Module } from '@nestjs/common';
import { FlashcardsModule } from '../flashcards/flashcards.module';
import { AnkiiIntegrationController } from './ankii-integration.controller';
import { AnkiiIntegrationService } from './ankii-integration.service';

@Module({
  imports: [FlashcardsModule],
  controllers: [AnkiiIntegrationController],
  providers: [AnkiiIntegrationService],
  exports: [AnkiiIntegrationService],
})
export class AnkiiIntegrationModule {}