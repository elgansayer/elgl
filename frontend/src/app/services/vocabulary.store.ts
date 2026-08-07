import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface Flashcard {
  id: string;
  user_id: string;
  word_token: string;
  original_context?: string;
  translation: string;
  definition?: string;
  pronunciation_url?: string;
  srs_level: number;
  easiness_factor: number;
  repetitions: number;
  interval_days: number;
  next_review_at: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface TranslationResult {
  original_text: string;
  translated_text: string;
  detected_language: string;
  transliteration?: string;
  definition?: string;
  pronunciation_url?: string;
}

export interface GrammarCheckResult {
  original: string;
  corrected: string;
  explanation: string;
  errors_found: number;
}

export interface WordBreakdownItem {
  word: string;
  score: number;
  feedback?: string;
}

export interface PronunciationScoreResult {
  overall_score: number;
  breakdown: WordBreakdownItem[];
  feedback_summary: string;
}

@Injectable({
  providedIn: 'root',
})
export class VocabularyStore {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private flashcardsUrl = `${environment.apiUrl}/flashcards`;
  private nlpUrl = `${environment.apiUrl}/nlp`;

  // Reactive state map of word_token -> Flashcard
  readonly flashcardMap = signal<Map<string, Flashcard>>(new Map());
  readonly allFlashcards = signal<Flashcard[]>([]);
  readonly dueReviews = signal<Flashcard[]>([]);
  readonly isLoading = signal<boolean>(false);

  /** Total count from last paginated fetch */
  readonly totalFlashcards = signal<number>(0);
  /** Total due count from last paginated fetch */
  readonly totalDueReviews = signal<number>(0);

  /** Cards queued for a deck-specific review session */
  readonly pendingReviewCards = signal<Flashcard[]>([]);

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`,
    };
  }

  /**
   * Load flashcards with pagination. Best for large collections.
   * @param limit Page size (default 50)
   * @param offset Page offset (default 0)
   * @param level Optional SRS level filter
   */
  async loadAllFlashcards(limit?: number, offset?: number, level?: number): Promise<void> {
    this.isLoading.set(true);
    try {
      let url = this.flashcardsUrl;
      const params = new URLSearchParams();
      if (limit !== undefined) params.set('limit', String(limit));
      if (offset !== undefined) params.set('offset', String(offset));
      if (level !== undefined) params.set('level', String(level));
      const qs = params.toString();
      if (qs) url = `${url}?${qs}`;

      const result = await firstValueFrom(
        this.http.get<PaginatedResponse<Flashcard>>(url, { headers: this.getHeaders() }),
      );
      this.allFlashcards.set(result.data);
      this.totalFlashcards.set(result.total);
      const map = new Map<string, Flashcard>();
      result.data.forEach((fc) => map.set(fc.word_token.toLowerCase(), fc));
      this.flashcardMap.set(map);
    } catch (e) {
      console.warn('Failed to load flashcards:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Load due reviews with pagination.
   * @param limit Page size (default 50)
   * @param offset Page offset (default 0)
   */
  async loadDueReviews(limit?: number, offset?: number): Promise<void> {
    try {
      let url = `${this.flashcardsUrl}/due`;
      const params = new URLSearchParams();
      if (limit !== undefined) params.set('limit', String(limit));
      if (offset !== undefined) params.set('offset', String(offset));
      const qs = params.toString();
      if (qs) url = `${url}?${qs}`;

      const result = await firstValueFrom(
        this.http.get<PaginatedResponse<Flashcard>>(url, { headers: this.getHeaders() }),
      );
      this.dueReviews.set(result.data);
      this.totalDueReviews.set(result.total);
    } catch (e) {
      console.warn('Failed to load due reviews:', e);
    }
  }

  getWordStatus(word: string): {
    level: number;
    colorClass: string;
    colourClass: string;
    flashcard?: Flashcard;
  } {
    const clean = word.toLowerCase().trim();
    const fc = this.flashcardMap().get(clean);
    if (!fc) {
      // Level 0 = New / Blue
      const cls =
        'bg-blue-500/20 text-blue-900 border-b-2 border-blue-400 cursor-pointer hover:bg-blue-200';
      return { level: 0, colorClass: cls, colourClass: cls };
    }
    if (fc.srs_level >= 4) {
      // Level 4+ = Known / White (normal text appearance)
      const cls = 'text-text-primary  cursor-pointer hover:underline';
      return { level: fc.srs_level, colorClass: cls, colourClass: cls, flashcard: fc };
    }
    // Level 1 to 3 = Learning / Yellow
    const cls =
      'bg-amber-500/20 text-amber-400 border-b-2 border-amber-500 cursor-pointer hover:bg-amber-200 font-medium';
    return { level: fc.srs_level, colorClass: cls, colourClass: cls, flashcard: fc };
  }

  async saveWord(payload: {
    word_token: string;
    translation: string;
    original_context?: string;
    definition?: string;
    pronunciation_url?: string;
  }): Promise<Flashcard> {
    const fc = await firstValueFrom(
      this.http.post<Flashcard>(this.flashcardsUrl, payload, { headers: this.getHeaders() }),
    );
    this.allFlashcards.update((list) => {
      const filtered = list.filter(
        (item) => item.id !== fc.id && item.word_token !== fc.word_token,
      );
      return [fc, ...filtered];
    });
    this.flashcardMap.update((map) => {
      const next = new Map(map);
      next.set(fc.word_token.toLowerCase(), fc);
      return next;
    });
    return fc;
  }

  async updateSrsLevel(flashcardId: string, quality: number): Promise<Flashcard> {
    const fc = await firstValueFrom(
      this.http.patch<Flashcard>(
        `${this.flashcardsUrl}/${flashcardId}/srs`,
        { quality },
        { headers: this.getHeaders() },
      ),
    );
    this.triggerHapticFeedback(fc.srs_level);
    this.allFlashcards.update((list) => list.map((item) => (item.id === fc.id ? fc : item)));
    this.flashcardMap.update((map) => {
      const next = new Map(map);
      next.set(fc.word_token.toLowerCase(), fc);
      return next;
    });
    return fc;
  }

  // NLP API calls
  async translateWordOrSentence(
    text: string,
    targetLang: string,
    sourceLang?: string,
  ): Promise<TranslationResult> {
    return firstValueFrom(
      this.http.post<TranslationResult>(
        `${this.nlpUrl}/translate`,
        {
          text,
          target_language: targetLang,
          source_language: sourceLang,
        },
        { headers: this.getHeaders() },
      ),
    );
  }

  async checkGrammar(text: string, language?: string): Promise<GrammarCheckResult> {
    return firstValueFrom(
      this.http.post<GrammarCheckResult>(
        `${this.nlpUrl}/grammar-check`,
        { text, language },
        { headers: this.getHeaders() },
      ),
    );
  }

  async scorePronunciation(
    audioUrl: string,
    targetText: string,
    language?: string,
  ): Promise<PronunciationScoreResult> {
    return firstValueFrom(
      this.http.post<PronunciationScoreResult>(
        `${this.nlpUrl}/pronunciation-score`,
        {
          audio_url: audioUrl,
          target_text: targetText,
          language,
        },
        { headers: this.getHeaders() },
      ),
    );
  }

  /**
   * Triggers haptic feedback based on SRS level.
   * Known (level >=4) -> success buzz
   * Learning (level 1-3) -> gentle pulse
   */
  private triggerHapticFeedback(level: number): void {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (level >= 4) {
        // success buzz 100ms
        navigator.vibrate(100);
      } else {
        // gentle pulsing pattern [on, off, on]
        navigator.vibrate([50, 50, 50]);
      }
    }
  }
}
