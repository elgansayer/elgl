import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateFlashcardDto, UpdateSrsDto } from './dto/flashcard.dto';
import { Flashcard } from './interfaces/flashcard.interface';
import { XpService } from '../xp/xp.service';

@Injectable()
export class FlashcardsService {
  constructor(
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
      throw new Error(`Failed to create/update flashcard: ${msg}`);
    }

    // Award XP for creating a flashcard
    void this.xpService.awardXpForActivity(userId, 'create_flashcard');

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
      throw new Error(
        `Failed to fetch flashcard for SRS update: ${fetchErr?.message ?? 'Not found'}`,
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
      throw new Error(`Failed to update SRS review level: ${msg}`);
    }

    // Award XP for reviewing a flashcard
    void this.xpService.awardXpForActivity(userId, 'review_flashcard');

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
    const newEf = Math.max(
      1.3,
      ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
    );

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
    return response.data;
  }

  async getDueReviews(userId: string): Promise<Flashcard[]> {
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
    return response.data;
  }
}
