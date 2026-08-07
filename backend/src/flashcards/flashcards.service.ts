import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import Redis from 'ioredis';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateFlashcardDto, UpdateSrsDto } from './dto/flashcard.dto';
import { Flashcard } from './interfaces/flashcard.interface';
import { XpService } from '../xp/xp.service';
import { MetricsService } from '../metrics/metrics.service';
import { withRetry } from '../common/retry';
import { CloudflareCacheService } from '../cloudflare/cache.service';
import { CACHE_TAG_FLASHCARDS, CACHE_TAG_DUE_REVIEWS } from '../common/cache.interceptor';

const FLASHCARD_LIST_CACHE_PREFIX = 'flashcards:list:';
const FLASHCARD_LIST_CACHE_TTL = 300; // 5 minutes
const DUE_REVIEWS_CACHE_PREFIX = 'flashcards:due:';
const DUE_REVIEWS_CACHE_TTL = 60; // 1 minute

@Injectable()
export class FlashcardsService {
  constructor(
    @InjectPinoLogger(FlashcardsService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly xpService: XpService,
    private readonly metricsService: MetricsService,
    private readonly cloudflareCacheService: CloudflareCacheService,
  ) {}

  private getRedis(): Redis {
    return this.supabaseService.getRedisClient();
  }

  async createOrUpdateFlashcard(
    userId: string,
    dto: CreateFlashcardDto,
  ): Promise<Flashcard> {
    const supabase = this.supabaseService.getClient();
    const cleanToken = dto.word_token.toLowerCase().trim();

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

    if (response.error || !response.data) {
      const msg = response.error?.message ?? 'Unknown error';
      this.logger.error(
        { userId, wordToken: cleanToken, error: msg },
        'Failed to create/update flashcard',
      );
      throw new Error(`Failed to create/update flashcard: ${msg}`);
    }

    // Invalidate Redis caches for this user's flashcard lists
    this.invalidateUserFlashcardCaches(userId);

    // Award XP for creating a flashcard
    void this.xpService.awardXpForActivity(userId, 'create_flashcard');

    this.metricsService.recordSrsFlashcardCreated();

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
    const reviewStartTime = Date.now();
    const supabase = this.supabaseService.getClient();

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

    if (response.error || !response.data) {
      const msg = response.error?.message ?? 'Unknown error';
      this.logger.error(
        { userId, flashcardId, error: msg },
        'Failed to update SRS review level',
      );
      throw new Error(`Failed to update SRS review level: ${msg}`);
    }

    // Invalidate Redis caches for this user's flashcard lists
    this.invalidateUserFlashcardCaches(userId);

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

  async getFlashcards(userId: string, level?: number): Promise<Flashcard[]> {
    const cacheKey =
      level !== undefined && !isNaN(level)
        ? `${FLASHCARD_LIST_CACHE_PREFIX}${userId}:level:${level}`
        : `${FLASHCARD_LIST_CACHE_PREFIX}${userId}`;

    // Check Redis cache first
    const redis = this.getRedis();
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        const parsed: unknown = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed as Flashcard[];
        }
      } catch {
        this.logger.warn(
          { cacheKey },
          'Failed to parse cached flashcard list, falling back to database',
        );
      }
    }

    const supabase = this.supabaseService.getClient();
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
      return [];
    }

    // Cache the result in Redis
    void redis.set(
      cacheKey,
      JSON.stringify(response.data),
      'EX',
      FLASHCARD_LIST_CACHE_TTL,
    );

    return response.data;
  }

  async getDueReviews(userId: string): Promise<Flashcard[]> {
    const cacheKey = `${DUE_REVIEWS_CACHE_PREFIX}${userId}`;

    // Check Redis cache first
    const redis = this.getRedis();
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        const parsed: unknown = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed as Flashcard[];
        }
      } catch {
        this.logger.warn(
          { cacheKey },
          'Failed to parse cached due reviews, falling back to database',
        );
      }
    }

    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', userId)
      .lt('srs_level', 4)
      .lte('next_review_at', new Date().toISOString())
      .order('next_review_at', { ascending: true });

    if (response.error || !response.data) {
      return [];
    }

    // Cache the result in Redis (short TTL since due reviews change frequently)
    void redis.set(
      cacheKey,
      JSON.stringify(response.data),
      'EX',
      DUE_REVIEWS_CACHE_TTL,
    );

    return response.data;
  }

  /**
   * Invalidates Redis caches related to a user's flashcard state.
   * Called after any mutation that changes flashcards or SRS levels
   * (createOrUpdateFlashcard, updateSrsLevel).
   *
   * We use a pattern-based approach: delete known cache keys for the user.
   * Since the level filter creates cache keys like `flashcards:list:{userId}:level:{N}`,
   * we delete the main list cache plus all possible level-specific caches (levels 0-4).
   */
  private invalidateUserFlashcardCaches(userId: string): void {
    const redis = this.getRedis();
    // Delete the main flashcard list cache
    void redis.del(`${FLASHCARD_LIST_CACHE_PREFIX}${userId}`);
    // Delete all level-specific caches
    for (let level = 0; level <= 4; level++) {
      void redis.del(`${FLASHCARD_LIST_CACHE_PREFIX}${userId}:level:${level}`);
    }
    // Delete due reviews cache
    void redis.del(`${DUE_REVIEWS_CACHE_PREFIX}${userId}`);

    // Also invalidate Cloudflare edge cache for this user's SRS endpoints
    void this.purgeSrsCache(userId);
  }

  /**
   * Purges Cloudflare edge cache for the given user's SRS endpoints
   * (flashcard list and due reviews). Called after mutations to ensure
   * users see fresh data immediately.
   *
   * Fire-and-forget: failures are logged but do not block the response.
   */
  purgeSrsCache(userId: string): void {
    this.cloudflareCacheService
      .purgeByCacheTags([
        `${CACHE_TAG_FLASHCARDS}:${userId}`,
        `${CACHE_TAG_DUE_REVIEWS}:${userId}`,
      ])
      .then((purged) => {
        this.logger.info(
          { userId, purged },
          'Cloudflare edge cache invalidated for SRS',
        );
      })
      .catch((err: unknown) => {
        this.logger.warn(
          {
            userId,
            error: err instanceof Error ? err.message : 'Unknown error',
          },
          'Failed to purge Cloudflare edge cache for SRS',
        );
      });
  }
}
