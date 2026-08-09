import { Module } from '@nestjs/common';
import { FlashcardsController } from './flashcards.controller';
import { FlashcardsService } from './flashcards.service';
import { SuggestFlashcardsController } from './suggest-flashcards.controller';
import { SuggestFlashcardsService } from './suggest-flashcards.service';
import { SrsRateLimiterGuard } from './srs-rate-limiter.guard';
import { XpModule } from '../xp/xp.module';

@Module({
  imports: [XpModule],
  controllers: [FlashcardsController, SuggestFlashcardsController],
  providers: [FlashcardsService, SuggestFlashcardsService, SrsRateLimiterGuard],
  exports: [FlashcardsService, SuggestFlashcardsService],
})
export class FlashcardsModule {}
