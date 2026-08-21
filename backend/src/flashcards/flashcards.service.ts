import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateFlashcardDto, UpdateSrsDto } from './dto/flashcard.dto';
import { Flashcard, SrsHealthStatus } from './interfaces/flashcard.interface';
import { XpService } from '../xp/xp.service';
import { MetricsService } from '../metrics/metrics.service';
import { withRetry, isRateLimitError } from '../common/retry';

/**
 * Service responsible for flashcard CRUD and SRS (SM-2) scheduling with
 * graceful degradation: when Supabase is unreachable, the service falls
 * back to local computation and in-memory state so user reviews are never lost.
 */
@Injectable()
export class FlashcardsService {
  /** In-memory store used as fallback when database is unavailable. */
  private readonly memoryStore = new Map<string, Flashcard>();

  /** Timestamp of last successful DB write (null if never succeeded). */
  private lastSuccessfulSync: string | null = null;

  /** Count of degraded operations since last successful sync. */
  private degradedOperationCount = 0;

  /** Maximum number of entries allowed in the in-memory store to prevent unbounded growth. */
  private readonly MAX_MEMORY_STORE_SIZE = 10_000;

  /** Maximum number of flashcards returned in a single query (hard cap). */
  private readonly MAX_FLASHCARDS_PER_QUERY = 200;

  /** Maximum number of due reviews returned in a single query. */
  private readonly MAX_DUE_REVIEWS_PER_QUERY = 100;

  constructor(
    @InjectPinoLogger(FlashcardsService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly xpService: XpService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Returns the current SRS health status for monitoring / status endpoints.
   */
  getHealthStatus(): SrsHealthStatus {
    const degradedServices: string[] = [];
    if (this.degradedOperationCount > 0) {
      degradedServices.push('supabase-flashcards-write');
    }
    return {
      healthy: this.degradedOperationCount === 0,
      mode: this.degradedOperationCount === 0 ? 'full' : 'degraded',
      degradedServices,
      lastSuccessfulSync: this.lastSuccessfulSync,
      cacheStats: {
        cachedFlashcardCount: this.memoryStore.size,
        pendingSyncCount: this.degradedOperationCount,
      },
    };
  }

  /**
   * Detects whether an error indicates the database is completely unavailable
   * (not just a rate-limit). These errors trigger graceful degradation.
   */
  private isConnectivityError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const err = error as Record<string, unknown>;

    const msg =
      typeof err.message === 'string' ? err.message.toLowerCase() : '';
    if (
      msg.includes('fetch failed') ||
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('econnrefused') ||
      msg.includes('connection') ||
      msg.includes('unreachable')
    ) {
      return true;
    }

    return isRateLimitError(error);
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
      const error = response.error;

      if (this.isConnectivityError(error)) {
        this.logger.warn(
          { userId, wordToken: cleanToken, error: msg },
          'Database unavailable, using degraded fallback for flashcard creation',
        );
        return this.createDegradedFlashcard(userId, cleanToken, dto);
      }

      this.logger.error(
        { userId, wordToken: cleanToken, error: msg },
        'Failed to create/update flashcard',
      );
      throw new Error(`Failed to create/update flashcard: ${msg}`);
    }

    this.markSuccessfulSync();
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

    // Try to fetch current card state; use SM-2 defaults if unavailable
    let current: {
      easiness_factor: number;
      repetitions: number;
      interval_days: number;
    } | null = null;

    try {
      const fetchResult = await withRetry(
        () =>
          supabase
            .from('flashcards')
            .select('easiness_factor, repetitions, interval_days')
            .eq('id', flashcardId)
            .eq('user_id', userId)
            .single(),
        { logger: this.logger },
      );

      if (fetchResult.error || !fetchResult.data) {
        if (this.isConnectivityError(fetchResult.error)) {
          this.logger.warn(
            { userId, flashcardId },
            'Database unavailable for SRS fetch, continuing with SM-2 defaults',
          );
        } else {
          const msg = fetchResult.error?.message ?? 'Not found';
          this.logger.error(
            { userId, flashcardId, error: msg },
            'Failed to fetch flashcard for SRS update',
          );
          throw new Error(`Failed to fetch flashcard for SRS update: ${msg}`);
        }
      } else {
        current = fetchResult.data;
      }
    } catch (error) {
      if (!this.isConnectivityError(error)) {
        throw error;
      }
      this.logger.warn(
        { userId, flashcardId },
        'Database unavailable for SRS fetch, continuing with SM-2 defaults',
      );
    }

    const { newEf, newRepetitions, newInterval, newSrsLevel } =
      this.applySm2Algorithm(
        dto.quality,
        current?.easiness_factor ?? 2.5,
        current?.repetitions ?? 0,
        current?.interval_days ?? 0,
      );

    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);

    // Attempt to persist; fall back to degraded if DB is unreachable
    try {
      const updateResult = await withRetry(
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

      if (updateResult.error || !updateResult.data) {
        const msg = updateResult.error?.message ?? 'Unknown error';
        if (this.isConnectivityError(updateResult.error)) {
          this.logger.warn(
            { userId, flashcardId },
            'Database unavailable for SRS write, returning degraded result',
          );
        } else {
          this.logger.error(
            { userId, flashcardId, error: msg },
            'Failed to update SRS review level',
          );
          throw new Error(`Failed to update SRS review level: ${msg}`);
        }
      } else {
        this.markSuccessfulSync();
        void this.xpService.awardXpForActivity(userId, 'review_flashcard');
        this.recordReviewMetrics(reviewStartTime, dto.quality);
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
        return updateResult.data;
      }
    } catch (error) {
      if (!this.isConnectivityError(error)) {
        throw error;
      }
      this.logger.warn(
        { userId, flashcardId },
        'Database unavailable for SRS write, returning degraded result',
      );
    }

    // Construct and return degraded flashcard (locally computed, not persisted)
    const degradedCard: Flashcard = {
      id: flashcardId,
      user_id: userId,
      word_token: '',
      translation: '',
      srs_level: newSrsLevel,
      easiness_factor: newEf,
      repetitions: newRepetitions,
      interval_days: newInterval,
      next_review_at: nextReviewAt.toISOString(),
      created_at: new Date().toISOString(),
      degraded: true,
    };

    this.memoryStore.set(flashcardId, degradedCard);
    this.degradedOperationCount++;
    this.recordReviewMetrics(reviewStartTime, dto.quality);

    this.logger.info(
      { userId, flashcardId, quality: dto.quality, newSrsLevel, newInterval },
      'SRS review completed (degraded - local computation)',
    );

    return degradedCard;
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
  applySm2Algorithm(
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
    const q = Math.max(0, Math.min(5, quality));

    const newEf = Math.max(1.3, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

    let newRepetitions: number;
    let newInterval: number;

    if (q < 3) {
      newRepetitions = 0;
      newInterval = 1;
    } else {
      if (repetitions === 0) {
        newInterval = 1;
      } else if (repetitions === 1) {
        newInterval = 6;
      } else {
        newInterval = Math.round(interval * ef);
      }
      newRepetitions = repetitions + 1;
    }

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
    limit = 50,
    offset = 0,
  ): Promise<Flashcard[]> {
    const safeLimit = Math.min(
      Math.max(1, limit),
      this.MAX_FLASHCARDS_PER_QUERY,
    );
    const safeOffset = Math.max(0, offset);
    const supabase = this.supabaseService.getClient();
    let query = supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (level !== undefined && !isNaN(level)) {
      query = query.eq('srs_level', level);
    }

    query = query.range(safeOffset, safeOffset + safeLimit - 1);

    try {
      const response = await query;
      if (response.error || !response.data) {
        if (this.isConnectivityError(response.error)) {
          this.logger.warn(
            { userId },
            'Database unavailable for getFlashcards, returning from memory store',
          );
          return this.getCachedFlashcards(userId, level).slice(
            safeOffset,
            safeOffset + safeLimit,
          );
        }
        return [];
      }
      return response.data;
    } catch (error) {
      this.logger.warn(
        { userId, error: (error as Error).message },
        'getFlashcards failed, returning from memory store',
      );
      return this.getCachedFlashcards(userId, level).slice(
        safeOffset,
        safeOffset + safeLimit,
      );
    }
  }

  async getDueReviews(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<Flashcard[]> {
    const safeLimit = Math.min(
      Math.max(1, limit),
      this.MAX_DUE_REVIEWS_PER_QUERY,
    );
    const safeOffset = Math.max(0, offset);
    const supabase = this.supabaseService.getClient();
    try {
      const query = supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', userId)
        .lt('srs_level', 4)
        .lte('next_review_at', new Date().toISOString())
        .order('next_review_at', { ascending: true })
        .range(safeOffset, safeOffset + safeLimit - 1);

      const response = await query;

      if (response.error || !response.data) {
        if (this.isConnectivityError(response.error)) {
          this.logger.warn(
            { userId },
            'Database unavailable for getDueReviews, returning from memory store',
          );
          const cached = this.getCachedDueReviews(userId);
          return cached.slice(safeOffset, safeOffset + safeLimit);
        }
        return [];
      }
      return response.data;
    } catch (error) {
      this.logger.warn(
        { userId, error: (error as Error).message },
        'getDueReviews failed, returning from memory store',
      );
      const cached = this.getCachedDueReviews(userId);
      return cached.slice(safeOffset, safeOffset + safeLimit);
    }
  }

  // --- Private helpers ---

  private markSuccessfulSync(): void {
    this.lastSuccessfulSync = new Date().toISOString();
    this.degradedOperationCount = 0;
    // Clear the in-memory store when connectivity is restored to prevent unbounded memory growth.
    // Degraded entries are now stale since the DB is reachable again.
    if (this.memoryStore.size > 0) {
      this.logger.info(
        { clearedEntries: this.memoryStore.size },
        'Connectivity restored - clearing degraded memory store',
      );
      this.memoryStore.clear();
    }
  }

  private createDegradedFlashcard(
    userId: string,
    cleanToken: string,
    dto: CreateFlashcardDto,
  ): Flashcard {
    // Prevent unbounded memory growth: evict oldest entries when the
    // in-memory store exceeds its configured maximum capacity.
    if (this.memoryStore.size >= this.MAX_MEMORY_STORE_SIZE) {
      const oldestKey = this.memoryStore.keys().next().value;
      if (oldestKey !== undefined) {
        this.memoryStore.delete(oldestKey);
      }
    }

    const card: Flashcard = {
      id: `degraded-${Date.now()}-${randomUUID()}`,
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
      degraded: true,
    };
    this.memoryStore.set(card.id, card);
    this.degradedOperationCount++;
    return card;
  }

  private recordReviewMetrics(reviewStartTime: number, quality: number): void {
    const reviewDurationSeconds = (Date.now() - reviewStartTime) / 1000;
    const result = quality >= 3 ? 'pass' : 'fail';
    this.metricsService.recordSrsReviewCompleted(
      quality,
      result,
      reviewDurationSeconds,
    );
  }

  private getCachedFlashcards(userId: string, level?: number): Flashcard[] {
    const cards = Array.from(this.memoryStore.values()).filter(
      (c) => c.user_id === userId,
    );
    if (level !== undefined && !isNaN(level)) {
      return cards.filter((c) => c.srs_level === level);
    }
    return cards;
  }

  private getCachedDueReviews(userId: string): Flashcard[] {
    const now = new Date().toISOString();
    return Array.from(this.memoryStore.values()).filter(
      (c) =>
        c.user_id === userId &&
        (c.srs_level ?? 0) < 4 &&
        c.next_review_at <= now,
    );
  }
}
