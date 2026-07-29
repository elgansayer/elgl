import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

interface UserInterestTagRow {
  tag: string;
}

interface VocabularyRow {
  interest_tag: string;
  vocab_word: string;
  translation: string | null;
  srs_level: number;
}

export interface VocabularyEntry {
  interestTag: string;
  vocabWord: string;
  translation: string | null;
  srsLevel: number;
}

@Injectable()
export class UserInterestsService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  async getUserInterests(userId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('user_interests')
      .select('tag')
      .eq('user_id', userId)
      .returns<UserInterestTagRow[]>();
    if (error) throw error;
    return (data ?? []).map((r) => r.tag);
  }

  async updateUserInterests(userId: string, tags: string[]): Promise<void> {
    // remove all existing interests
    await this.supabase.from('user_interests').delete().eq('user_id', userId);
    if (tags.length === 0) return;
    const rows = tags.map((tag) => ({ user_id: userId, tag }));
    const { error } = await this.supabase.from('user_interests').insert(rows);
    if (error) throw error;
  }

  async getVocabularyForInterests(
    tags: string[],
    language: string,
  ): Promise<VocabularyEntry[]> {
    const { data, error } = await this.supabase
      .from('interest_vocabulary')
      .select('interest_tag, vocab_word, translation, srs_level')
      .in('interest_tag', tags)
      .eq('language', language)
      .returns<VocabularyRow[]>();
    if (error) throw error;
    return (data ?? []).map((r) => ({
      interestTag: r.interest_tag,
      vocabWord: r.vocab_word,
      translation: r.translation,
      srsLevel: r.srs_level,
    }));
  }
}
