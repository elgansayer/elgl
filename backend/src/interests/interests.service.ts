import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { LlmProxyService } from '../llm-proxy/llm-proxy.service';

// Simple DTOs (no separate file)
export interface InterestVocabularyDto {
  id: string;
  name: string;
  vocabulary: { word: string; translation: string }[];
}

export interface UserInterestDto {
  user_id: string;
  interest_id: string[];
}

interface InterestRow {
  id: string;
  name: string;
  interest_vocabulary: {
    word: string;
    translation: string;
    language: string;
  }[];
}

interface UserInterestRow {
  interest_id: string;
}

interface VocabRow {
  word: string;
  translation: string;
}

@Injectable()
export class InterestsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly llmProxyService: LlmProxyService,
  ) {}

  private get supabase(): SupabaseClient {
    return this.supabaseService.getClient();
  }

  async findAll(targetLanguage: string): Promise<InterestVocabularyDto[]> {
    const { data, error } = await this.supabase
      .from('interests')
      .select(
        'id, name, interest_vocabulary!inner(word, translation, language)',
      )
      .eq('interest_vocabulary.language', targetLanguage)
      .returns<InterestRow[]>();

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      vocabulary: row.interest_vocabulary ?? [],
    }));
  }

  async findById(id: string): Promise<Pick<InterestRow, 'id' | 'name'> | null> {
    const { data, error } = await this.supabase
      .from('interests')
      .select('id, name')
      .eq('id', id)
      .single();
    if (error || !data) {
      return null;
    }
    return data;
  }

  async setUserInterests(userId: string, interestIds: string[]): Promise<void> {
    // remove previous interests
    const { error: deleteError } = await this.supabase
      .from('user_interests')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    // insert new ones
    const rows = interestIds.map((interest_id) => ({
      user_id: userId,
      interest_id,
    }));

    const { error: insertError } = await this.supabase
      .from('user_interests')
      .insert(rows);

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  async generateFlashcards(
    userId: string,
    targetLanguage: string,
  ): Promise<void> {
    // get all interest ids of the user
    const { data: userInterests, error: fetchError } = await this.supabase
      .from('user_interests')
      .select('interest_id')
      .eq('user_id', userId)
      .returns<UserInterestRow[]>();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    const interestIds = userInterests?.map((r) => r.interest_id) ?? [];

    if (interestIds.length === 0) return;

    const { data: vocabList, error: vocabError } = await this.supabase
      .from('interest_vocabulary')
      .select('word, translation')
      .in('interest_id', interestIds)
      .eq('language', targetLanguage)
      .returns<VocabRow[]>();

    if (vocabError) {
      throw new Error(vocabError.message);
    }

    const MAX_CONCURRENT_LLM_REQUESTS = 5;
    const vocabListArray = vocabList ?? [];

    const flashcardRows: Array<{
      user_id: string;
      word_token: string;
      source_language: string;
      translation: string;
      srs_level: number;
      next_review_at: string;
      context_sentence: string;
    }> = [];

    for (let i = 0; i < vocabListArray.length; i += MAX_CONCURRENT_LLM_REQUESTS) {
      const chunk = vocabListArray.slice(i, i + MAX_CONCURRENT_LLM_REQUESTS);
      const results = await Promise.all(
        chunk.map(async (v) => {
          let context_sentence = '';
          try {
            const prompt = `Write a very simple, single-sentence example in ${targetLanguage} using the word/phrase "${v.word}". Provide only the sentence, nothing else. Do not wrap in quotes or explain. Maximum 15 words.`;
            const result = await this.llmProxyService.proxyMessage(prompt);

            if (result.response && result.response.trim().length > 0) {
              const cleaned = result.response.trim().replace(/^["']|["']$/g, '');
              const wordCount = cleaned.split(/\s+/).length;
              if (
                wordCount <= 15 &&
                !cleaned.includes('\n') &&
                !cleaned.toLowerCase().startsWith('here is a')
              ) {
                context_sentence = cleaned;
              }
            }
          } catch {
            // Fallback to empty context sentence on LLM failure
          }
          return {
            user_id: userId,
            word_token: v.word.toLowerCase(),
            source_language: targetLanguage,
            translation: v.translation ?? '',
            srs_level: 0,
            next_review_at: new Date().toISOString(),
            context_sentence,
          };
        }),
      );
      flashcardRows.push(...results);
    }

    const { error: insertError } = await this.supabase
      .from('flashcards')
      .upsert(flashcardRows, {
        onConflict: 'user_id,word_token',
      });

    if (insertError) {
      throw new Error(insertError.message);
    }
  }
}
