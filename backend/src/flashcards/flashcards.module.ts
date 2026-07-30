import { Module } from '@nestjs/common';
import { FlashcardsController } from './flashcards.controller';
import { FlashcardsService } from './flashcards.service';
import { SuggestFlashcardsController } from './suggest-flashcards.controller';
import { SuggestFlashcardsService } from './suggest-flashcards.service';

@Module({
  controllers: [FlashcardsController, SuggestFlashcardsController],
  providers: [FlashcardsService, SuggestFlashcardsService],
  exports: [FlashcardsService, SuggestFlashcardsService],
})
export class FlashcardsModule {}
