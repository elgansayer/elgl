import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SuggestFlashcardsDto } from './dto/suggest-flashcards.dto';
import { FlashcardsService } from './flashcards.service';

@Injectable()
export class SuggestFlashcardsService {
  constructor(
    @InjectPinoLogger(SuggestFlashcardsService.name)
    private readonly logger: PinoLogger,
    private readonly flashcardsService: FlashcardsService,
  ) {}

  async suggestFromMessage(
    dto: SuggestFlashcardsDto,
  ): Promise<{ suggestions: string[] }> {
    const { message, user_id, target_language, exclude_known } = dto;

    // Tokenise message using Intl.Segmenter (requires Node >= 20)
    const segmenter = new Intl.Segmenter(target_language ?? 'en', {
      granularity: 'word',
    });
    const segments = Array.from(segmenter.segment(message));
    const words = segments
      .filter((s) => s.isWordLike)
      .map((s) => s.segment.toLowerCase().trim())
      .filter(Boolean);

    const uniqueWords = [...new Set(words)];

    // If a user_id is provided and exclude_known is not false, fetch already‑known words (SRS level = 4)
    let knownWords: Set<string> = new Set();
    if (user_id && exclude_known !== false) {
      knownWords = await this.flashcardsService.getKnownWordsCount(
        user_id,
        uniqueWords,
      );
    }

    const filteredWords = uniqueWords.filter((w) => !knownWords.has(w));

    this.logger.debug(
      {
        totalSegments: segments.length,
        uniqueWords: uniqueWords.length,
        knownWords: knownWords.size,
        suggestions: filteredWords.length,
      },
      'Flashcard suggestions generated from message',
    );

    return { suggestions: filteredWords };
  }
}
