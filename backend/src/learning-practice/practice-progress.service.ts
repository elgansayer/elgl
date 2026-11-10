import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type PracticeModule = 'verb_conjugation' | 'ipa_alphabet';

export interface PracticeAttemptInput {
  userId: string;
  module: PracticeModule;
  itemId: string;
  languageCode: string;
  submittedAnswer: string;
  correct: boolean;
}

export interface PracticeLanguageProgress {
  languageCode: string;
  total: number;
  correct: number;
}

export interface PracticeProgressSummary {
  total: number;
  correct: number;
  accuracy: number;
  byLanguage: PracticeLanguageProgress[];
}

const PROGRESS_WINDOW = 500;

const EMPTY_SUMMARY: PracticeProgressSummary = {
  total: 0,
  correct: 0,
  accuracy: 0,
  byLanguage: [],
};

interface StoredAttempt {
  correct: boolean;
  language_code: string;
}

@Injectable()
export class PracticeProgressService {
  private readonly logger = new Logger(PracticeProgressService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async recordAttempt(input: PracticeAttemptInput): Promise<void> {
    try {
      const { error } = await this.supabaseService
        .getClient()
        .from('learning_practice_attempts')
        .insert({
          user_id: input.userId,
          module: input.module,
          item_id: input.itemId,
          language_code: input.languageCode,
          submitted_answer: input.submittedAnswer,
          correct: input.correct,
        });

      if (error) {
        this.logger.warn(
          `Learning practice attempt was not stored (${error.code ?? 'unknown'})`,
        );
      }
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'unknown';
      this.logger.warn(`Learning practice attempt was not stored (${reason})`);
    }
  }

  async summarise(
    userId: string,
    module: PracticeModule,
  ): Promise<PracticeProgressSummary> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('learning_practice_attempts')
        .select('correct, language_code')
        .eq('user_id', userId)
        .eq('module', module)
        .order('created_at', { ascending: false })
        .limit(PROGRESS_WINDOW);

      if (error) {
        this.logger.warn(
          `Learning practice progress lookup failed (${error.code ?? 'unknown'})`,
        );
        return { ...EMPTY_SUMMARY, byLanguage: [] };
      }

      return this.summariseRows(data ?? []);
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'unknown';
      this.logger.warn(`Learning practice progress lookup failed (${reason})`);
      return { ...EMPTY_SUMMARY, byLanguage: [] };
    }
  }

  private summariseRows(
    rows: readonly StoredAttempt[],
  ): PracticeProgressSummary {
    if (rows.length === 0) return { ...EMPTY_SUMMARY, byLanguage: [] };

    const byLanguage = new Map<string, PracticeLanguageProgress>();
    let correct = 0;

    for (const row of rows) {
      if (row.correct) correct += 1;
      const entry = byLanguage.get(row.language_code) ?? {
        languageCode: row.language_code,
        total: 0,
        correct: 0,
      };
      entry.total += 1;
      if (row.correct) entry.correct += 1;
      byLanguage.set(row.language_code, entry);
    }

    return {
      total: rows.length,
      correct,
      accuracy: Math.round((correct / rows.length) * 100),
      byLanguage: [...byLanguage.values()].sort((left, right) =>
        left.languageCode.localeCompare(right.languageCode),
      ),
    };
  }
}
