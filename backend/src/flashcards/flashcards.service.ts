import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateFlashcardDto, UpdateSrsDto } from './dto/flashcard.dto';
import { Flashcard } from './interfaces/flashcard.interface';
import { XpService } from '../xp/xp.service';

const DEFAULT_EASINESS_FACTOR = 2.5;
const MINIMUM_EASINESS_FACTOR = 1.3;

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

    // Fetch current card to read existing SRS state
    const { data: current, error: fetchErr } = await supabase
      .from('flashcards')
      .select('*')
      .eq('id', flashcardId)
      .eq('user_id', userId)
      .single();

    if (fetchErr || !current) {
      const msg = fetchErr?.message ?? 'Flashcard not found';
      throw new Error(`Failed to update SRS review level: ${msg}`);
    }

    const { newInterval, newEF, newRepCount, newSrsLevel } =
      this.computeSm2(
        dto.quality,
        current.easiness_factor ?? DEFAULT_EASINESS_FACTOR,
        current.repetition_count ?? 0,
        current.srs_level ?? 0,
      );

    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);

    const response = await supabase
      .from('flashcards')
      .update({
        srs_level: newSrsLevel,
        easiness_factor: newEF,
        repetition_count: newRepCount,
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
   * Implements the SM-2 spaced repetition algorithm (SuperMemo 2).
   *
   * @param quality - User self-assessment grade (0-5):
   *   5 = perfect, 4 = correct after hesitation, 3 = correct with difficulty,
   *   2 = incorrect (correct answer seemed familiar), 1 = incorrect,
   *   0 = complete blackout
   * @param currentEF - Current easiness factor (default 2.5)
   * @param currentRepCount - Current repetition count (consecutive correct responses)
   * @param currentSrsLevel - Current SRS mastery level (0-4)
   * @returns Computed next interval (days), new easiness factor, new repetition count, new SRS level
   */
  private computeSm2(
    quality: number,
    currentEF: number,
    currentRepCount: number,
    currentSrsLevel: number,
  ): {
    newInterval: number;
    newEF: number;
    newRepCount: number;
    newSrsLevel: number;
  } {
    // Compute new easiness factor
    let newEF =
      currentEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (newEF < MINIMUM_EASINESS_FACTOR) {
      newEF = MINIMUM_EASINESS_FACTOR;
    }

    let newInterval: number;
    let newRepCount: number;
    let newSrsLevel: number;

    if (quality < 3) {
      // Failed recall - reset repetition count and interval
      newRepCount = 0;
      newInterval = 1;
      newSrsLevel = Math.max(0, currentSrsLevel - 1);
    } else {
      // Successful recall
      newRepCount = currentRepCount + 1;

      if (newRepCount === 1) {
        newInterval = 1;
        newSrsLevel = 1;
      } else if (newRepCount === 2) {
        newInterval = 6;
        newSrsLevel = 2;
      } else {
        // Use easiness factor to scale interval
        // The previous interval is derived from the current SRS level:
        // level 2 -> 6 days, level 3 -> ~14 days, level 4 -> ~30+ days
        const prevInterval = this.estimatePreviousInterval(
          currentSrsLevel,
          currentRepCount - 1,
        );
        newInterval = Math.round(prevInterval * newEF);
        newSrsLevel = Math.min(4, 2 + Math.floor(newRepCount / 2));
      }
    }

    return { newInterval, newEF, newRepCount, newSrsLevel };
  }

  /**
   * Estimates the previous interval based on SRS level and repetition count.
   * Used as a fallback when exact interval isn't available.
   */
  private estimatePreviousInterval(
    srsLevel: number,
    repCount: number,
  ): number {
    // Base intervals for each level that roughly correspond to SM-2 defaults
    const baseIntervals: Record<number, number> = {
      0: 1,
      1: 1,
      2: 6,
      3: 14,
      4: 30,
    };
    return baseIntervals[srsLevel] ?? 1;
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
      .lte('next_review_at', new Date().toISOString())
      .order('next_review_at', { ascending: true });

    if (response.error || !response.data) {
      return [];
    }
    return response.data;
  }
}
