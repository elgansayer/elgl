import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FlashcardsService } from '../flashcards/flashcards.service';
import { SupabaseService } from '../supabase/supabase.service';

const ANKI_EXPORT_PAGE_SIZE = 200;
const ANKI_MAX_EXPORT_CARDS = 1000;
const ANKI_MAX_IMPORT_CARDS = 500;
const ANKI_MAX_IMPORT_ERRORS = 20;

export interface AnkiExportResult {
  content: string;
  exported: number;
  truncated: boolean;
}

export interface AnkiImportError {
  line: number;
  reason: string;
}

export interface AnkiImportResult {
  imported: number;
  skipped: number;
  errors: AnkiImportError[];
}

interface ParsedAnkiCard {
  wordToken: string;
  translation: string;
  originalContext?: string;
  definition?: string;
}

@Injectable()
export class AnkiiIntegrationService {
  constructor(
    private readonly flashcardsService: FlashcardsService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async exportUserFlashcards(userId: string): Promise<AnkiExportResult> {
    const cards = [];

    for (
      let offset = 0;
      offset < ANKI_MAX_EXPORT_CARDS;
      offset += ANKI_EXPORT_PAGE_SIZE
    ) {
      const page = await this.flashcardsService.getFlashcards(
        userId,
        undefined,
        ANKI_EXPORT_PAGE_SIZE,
        offset,
      );
      cards.push(...page);
      if (page.length < ANKI_EXPORT_PAGE_SIZE) break;
    }

    const truncated = cards.length === ANKI_MAX_EXPORT_CARDS;
    const lines = [
      '#separator:tab',
      '#html:false',
      '#columns:Front\tBack\tContext\tDefinition',
      ...cards.map((card) =>
        [
          card.word_token,
          card.translation,
          card.original_context,
          card.definition,
        ]
          .map((value) => this.toTsvField(value))
          .join('\t'),
      ),
    ];

    return {
      content: `${lines.join('\n')}\n`,
      exported: cards.length,
      truncated,
    };
  }

  async importTsv(userId: string, content: string): Promise<AnkiImportResult> {
    const { cards, errors, skipped } = this.parseTsv(content);

    if (cards.length === 0) {
      return { imported: 0, skipped, errors };
    }

    const rows = cards.map((card) => ({
      user_id: userId,
      word_token: card.wordToken,
      translation: card.translation,
      original_context: card.originalContext ?? null,
      definition: card.definition ?? null,
    }));

    try {
      const response = await this.supabaseService
        .getClient()
        .from('flashcards')
        .upsert(rows, { onConflict: 'user_id, word_token' });

      if (response.error) {
        throw new ServiceUnavailableException(
          'Unable to import Anki flashcards right now',
        );
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        'Unable to import Anki flashcards right now',
      );
    }

    return { imported: cards.length, skipped, errors };
  }

  private parseTsv(content: string): {
    cards: ParsedAnkiCard[];
    errors: AnkiImportError[];
    skipped: number;
  } {
    const sourceLines = content.split(/\r?\n/);
    const dataLines = sourceLines
      .map((value, index) => ({ value, line: index + 1 }))
      .filter(({ value }) => value.trim() !== '' && !value.trimStart().startsWith('#'));

    if (dataLines.length > ANKI_MAX_IMPORT_CARDS) {
      throw new BadRequestException(
        `Anki import is limited to ${ANKI_MAX_IMPORT_CARDS} cards per request`,
      );
    }

    const cards: ParsedAnkiCard[] = [];
    const errors: AnkiImportError[] = [];
    const seenTokens = new Set<string>();
    let skipped = 0;

    for (const { value, line } of dataLines) {
      const fields = value.split('\t');
      const first = fields[0]?.trim() ?? '';
      const second = fields[1]?.trim() ?? '';

      if (
        first.toLowerCase() === 'front' &&
        second.toLowerCase() === 'back'
      ) {
        continue;
      }

      const reason = this.validateFields(fields, seenTokens);
      if (reason) {
        skipped++;
        if (errors.length < ANKI_MAX_IMPORT_ERRORS) {
          errors.push({ line, reason });
        }
        continue;
      }

      const wordToken = first.toLowerCase();
      seenTokens.add(wordToken);
      cards.push({
        wordToken,
        translation: second,
        originalContext: fields[2]?.trim() || undefined,
        definition: fields[3]?.trim() || undefined,
      });
    }

    return { cards, errors, skipped };
  }

  private validateFields(fields: string[], seenTokens: Set<string>): string | null {
    if (fields.length < 2 || fields.length > 4) {
      return 'Expected 2 to 4 tab-separated columns';
    }

    const front = fields[0]?.trim() ?? '';
    const back = fields[1]?.trim() ?? '';
    const context = fields[2]?.trim() ?? '';
    const definition = fields[3]?.trim() ?? '';

    if (!front || !back) return 'Front and Back are required';
    if (front.length > 200) return 'Front exceeds 200 characters';
    if (back.length > 500) return 'Back exceeds 500 characters';
    if (context.length > 1000) return 'Context exceeds 1000 characters';
    if (definition.length > 1000) return 'Definition exceeds 1000 characters';
    if (seenTokens.has(front.toLowerCase())) {
      return 'Duplicate Front value in import';
    }

    return null;
  }

  private toTsvField(value: string | null | undefined): string {
    return (value ?? '').replace(/[\t\r\n]+/g, ' ').trim();
  }
}