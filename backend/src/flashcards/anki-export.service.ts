import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { Flashcard } from './interfaces/flashcard.interface';

const EXPORT_PAGE_SIZE = 200;
const MAX_EXPORT_CARDS = 5_000;

export interface AnkiExportResult {
  content: string;
  count: number;
  truncated: boolean;
}

type ExportFlashcard = Pick<
  Flashcard,
  | 'id'
  | 'word_token'
  | 'translation'
  | 'definition'
  | 'original_context'
  | 'pronunciation_url'
>;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normaliseHtmlField(value: string | null | undefined): string {
  if (!value) return '';
  return escapeHtml(value.trim())
    .replace(/\r\n|\r|\n/g, '<br>')
    .replace(/\t/g, ' ');
}

export function safePronunciationUrl(value: string | null | undefined): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    if (url.username || url.password) return '';
    return escapeHtml(url.toString());
  } catch {
    return '';
  }
}

export function serializeAnkiTsv(cards: readonly ExportFlashcard[]): string {
  const lines = [
    '#separator:tab',
    '#html:true',
    '#deck:ELGL Vocabulary',
    '#notetype:Basic',
    '#columns:Front\tBack\tContext\tPronunciation URL\tELGL ID',
  ];

  for (const card of cards) {
    const translation = normaliseHtmlField(card.translation);
    const definition = normaliseHtmlField(card.definition);
    const back = definition ? `${translation}<br><small>${definition}</small>` : translation;
    const fields = [
      normaliseHtmlField(card.word_token),
      back,
      normaliseHtmlField(card.original_context),
      safePronunciationUrl(card.pronunciation_url),
      normaliseHtmlField(card.id),
    ];
    lines.push(fields.join('\t'));
  }

  return `${lines.join('\n')}\n`;
}

@Injectable()
export class AnkiExportService {
  constructor(
    @InjectPinoLogger(AnkiExportService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
  ) {}

  async exportUserFlashcards(userId: string): Promise<AnkiExportResult> {
    const client = this.supabaseService.getClient();
    const cards: ExportFlashcard[] = [];
    let offset = 0;

    while (cards.length <= MAX_EXPORT_CARDS) {
      const remaining = MAX_EXPORT_CARDS + 1 - cards.length;
      const pageSize = Math.min(EXPORT_PAGE_SIZE, remaining);
      const { data, error } = await client
        .from('flashcards')
        .select('id, word_token, translation, definition, original_context, pronunciation_url')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) {
        this.logger.warn(
          { errorCode: error.code ?? 'unknown' },
          'Anki export flashcard read failed',
        );
        throw new ServiceUnavailableException('Unable to export flashcards right now');
      }

      const page = (data ?? []) as ExportFlashcard[];
      cards.push(...page);
      if (page.length < pageSize) break;
      offset += page.length;
    }

    const truncated = cards.length > MAX_EXPORT_CARDS;
    const exportCards = truncated ? cards.slice(0, MAX_EXPORT_CARDS) : cards;

    this.logger.info(
      { cardCount: exportCards.length, truncated },
      'Anki flashcard export generated',
    );

    return {
      content: serializeAnkiTsv(exportCards),
      count: exportCards.length,
      truncated,
    };
  }
}
