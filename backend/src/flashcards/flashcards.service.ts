import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateFlashcardDto, UpdateSrsDto } from './dto/flashcard.dto';
import { Flashcard } from './interfaces/flashcard.interface';
import { XpService } from '../xp/xp.service';
<<<<<<< HEAD
<<<<<<< HEAD
import { MOCK_FLASHCARDS } from '../mock-data';
=======
<<<<<<< HEAD
=======
>>>>>>> origin/main
import { MetricsService } from '../metrics/metrics.service';
import { withRetry } from '../common/retry';
<<<<<<< HEAD
<<<<<<< HEAD
>>>>>>> origin/main
>>>>>>> origin/main
=======
>>>>>>> origin/main
=======
import { sanitiseFlashcardData } from './sanitise-flashcard.helper';
>>>>>>> origin/main

@Injectable()
export class FlashcardsService {
  constructor(
    @InjectPinoLogger(FlashcardsService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly xpService: XpService,
    private readonly metricsService: MetricsService,
  ) {}

  async createOrUpdateFlashcard(
    userId: string,
    dto: CreateFlashcardDto,
  ): Promise<Flashcard> {
    const supabase = this.supabaseService.getClient();
    const cleanToken = dto.word_token.toLowerCase().trim();

<<<<<<< HEAD
    try {
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
=======
    const response = await withRetry(
      () =>
        supabase
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
          .single(),
      { logger: this.logger },
    );
>>>>>>> origin/main

      if (response.error || !response.data) {
        throw new Error(response.error?.message ?? 'Unknown error');
      }

      // Award XP for creating a flashcard
      void this.xpService.awardXpForActivity(userId, 'create_flashcard');

      this.logger.info(
        { userId, wordToken: cleanToken, flashcardId: response.data.id },
        'Flashcard created/updated',
      );

      return response.data;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        { userId, wordToken: cleanToken, error: msg },
        'Failed to create/update flashcard via Supabase - using fallback',
      );

      // Graceful degradation: return a locally-constructed flashcard
      const fallbackCard: Flashcard = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        user_id: userId,
        word_token: cleanToken,
        original_context: dto.original_context ?? null,
        translation: dto.translation,
        definition: dto.definition ?? null,
        pronunciation_url: dto.pronunciation_url ?? null,
        srs_level: 0,
        easiness_factor: 2.5,
        repetitions: 0,
        interval_days: 0,
        next_review_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      return fallbackCard;
    }
<<<<<<< HEAD
=======

    // Award XP for creating a flashcard
    void this.xpService.awardXpForActivity(userId, 'create_flashcard');

    this.metricsService.recordSrsFlashcardCreated();

    this.logger.info(
      { userId, wordToken: cleanToken, flashcardId: response.data.id },
      'Flashcard created/updated',
    );

<<<<<<< HEAD
    return response.data;
>>>>>>> origin/main
=======
    return sanitiseFlashcardData(response.data);
>>>>>>> origin/main
  }

  async updateSrsLevel(
    userId: string,
    flashcardId: string,
    dto: UpdateSrsDto,
  ): Promise<Flashcard> {
    const reviewStartTime = Date.now();
    const supabase = this.supabaseService.getClient();

<<<<<<< HEAD
    // Default card state for graceful degradation
    let easinessFactor = 2.5;
    let repetitions = 0;
    let intervalDays = 0;

    try {
      // Fetch current card state to run SM-2 locally
      const { data: current, error: fetchErr } = await supabase
        .from('flashcards')
        .select('easiness_factor, repetitions, interval_days')
        .eq('id', flashcardId)
        .eq('user_id', userId)
        .single();

      if (fetchErr || !current) {
        throw new Error(fetchErr?.message ?? 'Not found');
      }

      easinessFactor = current.easiness_factor;
      repetitions = current.repetitions;
      intervalDays = current.interval_days;
    } catch (fetchError) {
      this.logger.warn(
        { userId, flashcardId, error: (fetchError as Error).message },
        'Failed to fetch flashcard for SRS update - using default SM-2 state',
      );
      // Continue with default values - graceful degradation
=======
    // Fetch current card state to run SM-2 locally (with retry for 429)
    const { data: current, error: fetchErr } = await withRetry(
      () =>
        supabase
          .from('flashcards')
          .select('easiness_factor, repetitions, interval_days')
          .eq('id', flashcardId)
          .eq('user_id', userId)
          .single(),
      { logger: this.logger },
    );

    if (fetchErr || !current) {
      const msg = fetchErr?.message ?? 'Not found';
      this.logger.error(
        { userId, flashcardId, error: msg },
        'Failed to fetch flashcard for SRS update',
      );
      throw new Error(`Failed to fetch flashcard for SRS update: ${msg}`);
>>>>>>> origin/main
    }

    const { newEf, newRepetitions, newInterval, newSrsLevel } =
      this.applySm2Algorithm(
        dto.quality,
        easinessFactor,
        repetitions,
        intervalDays,
      );

    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);

<<<<<<< HEAD
    try {
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
        throw new Error(response.error?.message ?? 'Unknown error');
      }

      // Award XP for reviewing a flashcard
      void this.xpService.awardXpForActivity(userId, 'review_flashcard');

      this.logger.info(
        { userId, flashcardId, quality: dto.quality, newSrsLevel, newInterval },
        'SRS review completed',
      );

      return response.data;
    } catch (updateError) {
      const msg = (updateError as Error).message;
      this.logger.warn(
        { userId, flashcardId, error: msg },
        'Failed to persist SRS update - returning locally computed result',
      );

      // Graceful degradation: return locally computed SRS state
      const fallbackCard: Flashcard = {
        id: flashcardId,
        user_id: userId,
        word_token: 'syncing',
        original_context: null,
        translation: 'syncing',
        definition: null,
        pronunciation_url: null,
        srs_level: newSrsLevel,
        easiness_factor: newEf,
        repetitions: newRepetitions,
        interval_days: newInterval,
        next_review_at: nextReviewAt.toISOString(),
        created_at: new Date().toISOString(),
      };
=======
    // Update with retry for HTTP 429 rate limiting
    const response = await withRetry(
      () =>
        supabase
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
          .single(),
      { logger: this.logger },
    );
>>>>>>> origin/main

      return fallbackCard;
    }
<<<<<<< HEAD
=======

    // Award XP for reviewing a flashcard
    void this.xpService.awardXpForActivity(userId, 'review_flashcard');

    // Record SRS review metrics
    const reviewDurationSeconds = (Date.now() - reviewStartTime) / 1000;
    const result = dto.quality >= 3 ? 'pass' : 'fail';
    this.metricsService.recordSrsReviewCompleted(
      dto.quality,
      result,
      reviewDurationSeconds,
    );

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

<<<<<<< HEAD
    return response.data;
>>>>>>> origin/main
=======
    return sanitiseFlashcardData(response.data);
>>>>>>> origin/main
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

  async getFlashcards(userId: string, level?: number): Promise<Flashcard[]> {
    const supabase = this.supabaseService.getClient();

    try {
      let query = supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (level !== undefined && !isNaN(level)) {
        query = query.eq('srs_level', level);
      }

      const response = await query;
      if (response.error || !response.data) {
        throw new Error(response.error?.message ?? 'Empty result');
      }
      return response.data;
    } catch (error) {
      this.logger.warn(
        { userId, error: (error as Error).message },
        'Failed to fetch flashcards - using mock fallback data',
      );

      // Graceful degradation: return mock flashcard data
      const fallbackCards = MOCK_FLASHCARDS.map((fc) => ({
        ...fc,
        user_id: userId,
      }));

      if (level !== undefined && !isNaN(level)) {
        return fallbackCards.filter((fc) => fc.srs_level === level);
      }

      return fallbackCards;
    }
<<<<<<< HEAD
=======
    return sanitiseFlashcardData(response.data);
>>>>>>> origin/main
  }

  async getDueReviews(userId: string): Promise<Flashcard[]> {
    const supabase = this.supabaseService.getClient();

    try {
      const response = await supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', userId)
        .lt('srs_level', 4)
        .lte('next_review_at', new Date().toISOString())
        .order('next_review_at', { ascending: true });

      if (response.error || !response.data) {
        throw new Error(response.error?.message ?? 'Empty result');
      }
      return response.data;
    } catch (error) {
      this.logger.warn(
        { userId, error: (error as Error).message },
        'Failed to fetch due reviews - using mock fallback data',
      );

      // Graceful degradation: return mock data filtered for due reviews
      const now = new Date().toISOString();
      const fallbackCards = MOCK_FLASHCARDS.filter(
        (fc) =>
          fc.srs_level < 4 &&
          fc.next_review_at <= now,
      ).map((fc) => ({
        ...fc,
        user_id: userId,
      }));

      fallbackCards.sort(
        (a, b) =>
          new Date(a.next_review_at).getTime() -
          new Date(b.next_review_at).getTime(),
      );

      return fallbackCards;
    }
<<<<<<< HEAD
=======
    return sanitiseFlashcardData(response.data);
>>>>>>> origin/main
  }
}
