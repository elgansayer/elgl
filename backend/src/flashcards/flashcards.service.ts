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

    return response.data as Flashcard;
  }

  async updateSrsLevel(
    userId: string,
    flashcardId: string,
    dto: UpdateSrsDto,
  ): Promise<Flashcard> {
    const supabase = this.supabaseService.getClient();

    // Compute next review interval
    const now = new Date();
    let addDays = 1;
    if (dto.srs_level === 1) addDays = 3;
    if (dto.srs_level === 2) addDays = 7;
    if (dto.srs_level === 3) addDays = 14;
    if (dto.srs_level === 4) addDays = 30;

    now.setDate(now.getDate() + addDays);

    const response = await supabase
      .from('flashcards')
      .update({
        srs_level: dto.srs_level,
        next_review_at: now.toISOString(),
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

    return response.data as Flashcard;
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
    return response.data as Flashcard[];
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
    return response.data as Flashcard[];
  }
}
