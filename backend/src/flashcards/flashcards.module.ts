import { Module } from '@nestjs/common';
import { FlashcardsController } from './flashcards.controller';
import { FlashcardsService } from './flashcards.service';
import { SuggestFlashcardsController } from './suggest-flashcards.controller';
import { SuggestFlashcardsService } from './suggest-flashcards.service';
import { AnkiExportController } from './anki-export.controller';
import { AnkiExportService } from './anki-export.service';
import { XpModule } from '../xp/xp.module';

@Module({
  imports: [XpModule],
  controllers: [FlashcardsController, SuggestFlashcardsController, AnkiExportController],
  providers: [FlashcardsService, SuggestFlashcardsService, AnkiExportService],
  exports: [FlashcardsService, SuggestFlashcardsService, AnkiExportService],
})
export class FlashcardsModule {}
