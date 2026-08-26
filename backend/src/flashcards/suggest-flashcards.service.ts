import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { SuggestFlashcardsDto } from './dto/suggest-flashcards.dto';

const MAX_KNOWN_WORDS = 2000;

@Injectable()
export class SuggestFlashcardsService {
  constructor(
    @InjectPinoLogger(SuggestFlashcardsService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
  ) {}

  async suggestFromMessage(
    authenticatedUserId: string,
    dto: SuggestFlashcardsDto,
  ): Promise<{ suggestions: string[] }> {
    const { message, target_language, exclude_known, max_results } = dto;
    const maxResults = Math.min(Math.max(1, max_results ?? 20), 100);

    let segmenter: Intl.Segmenter;
    try {
      segmenter = new Intl.Segmenter(target_language?.trim() || 'en', {
        granularity: 'word',
      });
    } catch {
      throw new BadRequestException('Unsupported target language');
    }

    const segments = Array.from(segmenter.segment(message));
    const words = segments
      .filter((segment) => segment.isWordLike)
      .map((segment) => segment.segment.toLocaleLowerCase(target_language || 'en').trim())
      .filter(Boolean);
    const uniqueWords = [...new Set(words)];

    let knownWords = new Set<string>();
    if (exclude_known !== false && uniqueWords.length > 0) {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase
        .from('flashcards')
        .select('word_token')
        .eq('user_id', authenticatedUserId)
        .eq('srs_level', 4)
        .limit(MAX_KNOWN_WORDS);

      if (error) {
        this.logger.warn(
          {
            failure: 'known_words_lookup_failed',
            candidateCount: uniqueWords.length,
          },
          'Unable to load mastered words for flashcard suggestions',
        );
        throw new ServiceUnavailableException(
          'Flashcard suggestions are temporarily unavailable',
        );
      }

      if (data?.length) {
        knownWords = new Set(
          data
            .map((row) =>
              typeof row.word_token === 'string'
                ? row.word_token.toLocaleLowerCase(target_language || 'en').trim()
                : '',
            )
            .filter(Boolean),
        );
      }
    }

    const suggestions = uniqueWords
      .filter((word) => !knownWords.has(word))
      .slice(0, maxResults);

    this.logger.debug(
      {
        totalSegments: segments.length,
        uniqueWords: uniqueWords.length,
        knownWords: knownWords.size,
        suggestions: suggestions.length,
        maxResults,
      },
      'Flashcard suggestions generated from message',
    );

    return { suggestions };
  }
}
