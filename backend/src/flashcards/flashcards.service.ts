import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateFlashcardDto, UpdateSrsDto } from './dto/flashcard.dto';
import { Flashcard } from './interfaces/flashcard.interface';
import { PaginatedResponse } from './interfaces/flashcard.interface';
import { XpService } from '../xp/xp.service';

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 200;
const KNOWN_WORDS_QUERY_LIMIT = 2000;

@Injectable()
export class FlashcardsService {
  constructor(
    @InjectPinoLogger(FlashcardsService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly xpService: XpService,
  ) {}

  async createOrUpdateFlashcard(
    userId: string,
    dto: CreateFlashcardDto,
  ): Promise<Flashcard> {
    const supabase = this.supabaseService.getClient();
    const cleanToken = dto.word_token.toLowerCase().trim();

    const response = await supabase
      .from('flashcards')
      .upsert(
        {
          user_id: userId,
          word_token: cleanToken,
          original_context: dto.original_context ?? null,
          translation: dto.translation,
          definition: dto.definition ?? null,
          pronunciation_url: dto.pronunciation_url ?? null,
        },
        { onConflict: 'user_id, word_token' },
      )
      .select()
      .single();

    if (response.error || !response.data) {
      const msg = response.error?.message ?? 'Unknown error';
      this.logger.error(
        { userId, wordToken: cleanToken, error: msg },
        'Failed to create/update flashcard',
      );
      throw new Error(`Failed to create/update flashcard: ${msg}`);
    }

    // Award XP for creating a flashcard
    void this.xpService.awardXpForActivity(userId, 'create_flashcard');

    this.logger.info(
      { userId, wordToken: cleanToken, flashcardId: response.data.id },
      'Flashcard created/updated',
    );

    return response.data;
  }

  async updateSrsLevel(
    userId: string,
    flashcardId: string,
    dto: UpdateSrsDto,
  ): Promise<Flashcard> {
    const supabase = this.supabaseService.getClient();

    // Fetch current card state to run SM-2 locally
    const { data: current, error: fetchErr } = await supabase
      .from('flashcards')
      .select('easiness_factor, repetitions, interval_days')
      .eq('id', flashcardId)
      .eq('user_id', userId)
      .single();

    if (fetchErr || !current) {
      const msg = fetchErr?.message ?? 'Not found';
      this.logger.error(
        { userId, flashcardId, error: msg },
        'Failed to fetch flashcard for SRS update',
      );
      throw new Error(
        `Failed to fetch flashcard for SRS update: ${msg}`,
      );
    }

    const { newEf, newRepetitions, newInterval, newSrsLevel } =
      this.applySm2Algorithm(
        dto.quality,
        current.easiness_factor,
        current.repetitions,
        current.interval_days,
      );

    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);

    const response = await supabase
      .from('flashcards')
      .update({
        srs_level: newSrsLevel,
        easiness_factor: newEf,
        repetitions: newRepetitions,
        interval_days: newInterval,
        next_review_at: nextReviewAt.toISOString(),
      })
      .eq('id', flashcardId)
      .eq('user_id', userId)
      .select()
      .single();

    if (response.error || !response.data) {
      const msg = response.error?.message ?? 'Unknown error';
      this.logger.error(
        { userId, flashcardId, error: msg },
        'Failed to update SRS review level',
      );
      throw new Error(`Failed to update SRS review level: ${msg}`);
    }

    // Award XP for reviewing a flashcard
    void this.xpService.awardXpForActivity(userId, 'review_flashcard');

    this.logger.info(
      {
        userId,
        flashcardId,
        quality: dto.quality,
        newSrsLevel,
        newInterval,
      },
      'SRS review completed',
    );

    return response.data;
  }

  /**
   * SM-2 algorithm for spaced repetition scheduling.
   *
   * @param quality - User's self-assessed recall quality (0-5).
   *   0: complete blackout
   *   1: incorrect response, but correct one remembered upon seeing it
   *   2: incorrect response, but correct one seemed easy to recall
   *   3: correct response with serious difficulty
   *   4: correct response after hesitation
   *   5: perfect response
   * @param ef - Current easiness factor (minimum 1.3).
   * @param repetitions - Current repetition count.
   * @param interval - Current interval in days.
   * @returns New SM-2 state.
   */
  private applySm2Algorithm(
    quality: number,
    ef: number,
    repetitions: number,
    interval: number,
  ): {
    newEf: number;
    newRepetitions: number;
    newInterval: number;
    newSrsLevel: number;
  } {
    // Clamp quality to valid range
    const q = Math.max(0, Math.min(5, quality));

    // Update easiness factor
    const newEf = Math.max(1.3, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

    let newRepetitions: number;
    let newInterval: number;

    if (q < 3) {
      // Failed - reset repetitions, short interval
      newRepetitions = 0;
      newInterval = 1;
    } else {
      // Passed - schedule next review
      if (repetitions === 0) {
        newInterval = 1;
      } else if (repetitions === 1) {
        newInterval = 6;
      } else {
        newInterval = Math.round(interval * ef);
      }
      newRepetitions = repetitions + 1;
    }

    // Derive srs_level from SM-2 state for backwards compatibility
    let newSrsLevel: number;
    if (newRepetitions === 0) {
      newSrsLevel = 0;
    } else if (newRepetitions === 1) {
      newSrsLevel = 1;
    } else if (newRepetitions === 2) {
      newSrsLevel = 2;
    } else if (newInterval < 21) {
      newSrsLevel = 3;
    } else {
      newSrsLevel = 4;
    }

    return {
      newEf: Number(newEf.toFixed(4)),
      newRepetitions,
      newInterval,
      newSrsLevel,
    };
  }

  async getFlashcards(
    userId: string,
    level?: number,
    limit?: number,
    offset?: number,
  ): Promise<PaginatedResponse<Flashcard>> {
    const supabase = this.supabaseService.getClient();
    const clampedLimit = Math.min(
      Math.max(1, limit ?? DEFAULT_PAGE_LIMIT),
      MAX_PAGE_LIMIT,
    );
    const safeOffset = Math.max(0, offset ?? 0);

    let countQuery = supabase
      .from('flashcards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (level !== undefined && !isNaN(level)) {
      countQuery = countQuery.eq('srs_level', level);
    }

    let dataQuery = supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (level !== undefined && !isNaN(level)) {
      dataQuery = dataQuery.eq('srs_level', level);
    }

    dataQuery = dataQuery.range(safeOffset, safeOffset + clampedLimit - 1);

    const [countResult, dataResult] = await Promise.all([
      countQuery,
      dataQuery,
    ]);

    const total = countResult.count ?? 0;

    if (dataResult.error) {
      this.logger.warn(
        { userId, error: dataResult.error.message },
        'Failed to fetch flashcards',
      );
      return { data: [], total, limit: clampedLimit, offset: safeOffset };
    }

    return {
      data: dataResult.data ?? [],
      total,
      limit: clampedLimit,
      offset: safeOffset,
    };
  }

  async getDueReviews(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<PaginatedResponse<Flashcard>> {
    const supabase = this.supabaseService.getClient();
    const clampedLimit = Math.min(
      Math.max(1, limit ?? DEFAULT_PAGE_LIMIT),
      MAX_PAGE_LIMIT,
    );
    const safeOffset = Math.max(0, offset ?? 0);
    const now = new Date().toISOString();

    let countQuery = supabase
      .from('flashcards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lt('srs_level', 4)
      .lte('next_review_at', now);

    let dataQuery = supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', userId)
      .lt('srs_level', 4)
      .lte('next_review_at', now)
      .order('next_review_at', { ascending: true })
      .range(safeOffset, safeOffset + clampedLimit - 1);

    const [countResult, dataResult] = await Promise.all([
      countQuery,
      dataQuery,
    ]);

    const total = countResult.count ?? 0;

    if (dataResult.error) {
      this.logger.warn(
        { userId, error: dataResult.error.message },
        'Failed to fetch due reviews',
      );
      return { data: [], total, limit: clampedLimit, offset: safeOffset };
    }

    return {
      data: dataResult.data ?? [],
      total,
      limit: clampedLimit,
      offset: safeOffset,
    };
  }

  async getKnownWordsCount(
    userId: string,
    wordTokens: string[],
  ): Promise<Set<string>> {
    if (wordTokens.length === 0) return new Set();

    const supabase = this.supabaseService.getClient();
    const knownWords: Set<string> = new Set();

    // Batch queries if word list is large
    const batchSize = 200;
    for (let i = 0; i < wordTokens.length; i += batchSize) {
      const batch = wordTokens.slice(i, i + batchSize);
      const { data } = await supabase
        .from('flashcards')
        .select('word_token')
        .eq('user_id', userId)
        .eq('srs_level', 4)
        .in('word_token', batch)
        .limit(KNOWN_WORDS_QUERY_LIMIT);

      if (data) {
        for (const row of data) {
          knownWords.add(row.word_token.toLowerCase());
        }
      }
    }

    return knownWords;
  }
}
