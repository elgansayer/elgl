import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface MutedWordRow {
  normalized_word: string;
}

export const MAX_MUTED_WORDS = 100;
export const MAX_MUTED_WORD_LENGTH = 64;

@Injectable()
export class MutedWordsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  normaliseWord(value: string): string {
    return value.normalize('NFKC').trim().toLocaleLowerCase('und');
  }

  private validateWord(value: string): string {
    const word = this.normaliseWord(value);
    if (!word) {
      throw new BadRequestException('Muted word must not be empty');
    }
    if (word.length > MAX_MUTED_WORD_LENGTH) {
      throw new BadRequestException(
        `Muted word must be ${MAX_MUTED_WORD_LENGTH} characters or fewer`,
      );
    }
    return word;
  }

  async list(userId: string): Promise<string[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('user_muted_words')
      .select('normalized_word')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new InternalServerErrorException('Failed to load muted words');
    }

    return ((data ?? []) as MutedWordRow[])
      .map((row) => this.normaliseWord(row.normalized_word))
      .filter(Boolean)
      .slice(0, MAX_MUTED_WORDS);
  }

  async add(userId: string, value: string): Promise<string[]> {
    const word = this.validateWord(value);
    const existing = await this.list(userId);

    if (existing.includes(word)) {
      return existing;
    }
    if (existing.length >= MAX_MUTED_WORDS) {
      throw new BadRequestException(
        `You can mute up to ${MAX_MUTED_WORDS} words`,
      );
    }

    const { error } = await this.supabaseService
      .getClient()
      .from('user_muted_words')
      // This migration is newer than the repository's hand-maintained Supabase
      // schema shim. Keep the cast local to the new table until generated types
      // replace that shim, matching existing unmapped-table callers.
      .insert({
        user_id: userId,
        word,
        normalized_word: word,
      } as never);

    if (error) {
      // A concurrent identical insert is idempotent. The database uniqueness
      // constraint is authoritative for races across devices.
      if (error.code === '23505') {
        return this.list(userId);
      }
      if (
        error.code === '23514' ||
        error.message?.includes('muted word limit reached')
      ) {
        throw new BadRequestException(
          `You can mute up to ${MAX_MUTED_WORDS} words`,
        );
      }
      throw new InternalServerErrorException('Failed to save muted word');
    }

    return this.list(userId);
  }

  async remove(userId: string, value: string): Promise<string[]> {
    const word = this.validateWord(value);
    const { error } = await this.supabaseService
      .getClient()
      .from('user_muted_words')
      .delete()
      .eq('user_id', userId)
      .eq('normalized_word', word);

    if (error) {
      throw new InternalServerErrorException('Failed to remove muted word');
    }

    return this.list(userId);
  }
}
