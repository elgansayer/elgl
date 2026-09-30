import { Module } from '@nestjs/common';
import { FlashcardsController } from './flashcards.controller';
import { FlashcardsService } from './flashcards.service';
import { SuggestFlashcardsController } from './suggest-flashcards.controller';
import { SuggestFlashcardsService } from './suggest-flashcards.service';
import { XpModule } from '../xp/xp.module';

@Module({
  imports: [XpModule],
  controllers: [FlashcardsController, SuggestFlashcardsController],
  providers: [FlashcardsService, SuggestFlashcardsService],
  exports: [FlashcardsService, SuggestFlashcardsService],
})
export class FlashcardsModule {}
