import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { ConfigService } from '@nestjs/config';
import { SuggestFlashcardsDto } from './dto/suggest-flashcards.dto';

@Injectable()
export class SuggestFlashcardsService {
  constructor(
    @InjectPinoLogger(SuggestFlashcardsService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
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
    // Capped at 5000 to prevent unbounded payload from power users with massive vocabularies
    let knownWords: Set<string> = new Set();
    if (user_id && exclude_known !== false) {
      const supabase = this.supabaseService.getClient();
      const { data } = await supabase
        .from('flashcards')
        .select('word_token')
        .eq('user_id', user_id)
        .eq('srs_level', 4)
        .limit(5000);
      if (data && data.length > 0) {
        knownWords = new Set(data.map((r) => r.word_token.toLowerCase()));
      }
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
