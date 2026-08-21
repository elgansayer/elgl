import { Injectable, inject, signal, computed, ErrorHandler } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { SrsOfflineService } from './srs-offline.service';
import { HtmlSanitisationService } from './html-sanitisation.service';

class SrsOperationError extends Error {
  override name = 'SrsOperationError';
  constructor(
    message: string,
    readonly srsOperation: string,
    stack?: string,
  ) {
    super(message);
    if (stack) {
      this.stack = stack;
    }
  }
}

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
  private srsOffline = inject(SrsOfflineService);
  private errorHandler = inject(ErrorHandler);
  private sanitisation = inject(HtmlSanitisationService);
  private flashcardsUrl = `${environment.apiUrl}/flashcards`;
  private nlpUrl = `${environment.apiUrl}/nlp`;

  /** Sanitises all user-authored string fields of a flashcard against XSS via DOMPurify. */
  private sanitiseFlashcard(fc: Flashcard): Flashcard {
    return {
      ...fc,
      word_token: this.sanitisation.sanitiseText(fc.word_token),
      translation: this.sanitisation.sanitiseText(fc.translation),
      original_context: fc.original_context
        ? this.sanitisation.sanitiseText(fc.original_context)
        : undefined,
      definition: fc.definition ? this.sanitisation.sanitiseText(fc.definition) : undefined,
      pronunciation_url: fc.pronunciation_url
        ? this.sanitisation.sanitiseUrl(fc.pronunciation_url)
        : undefined,
    };
  }

  // Reactive state map of word_token -> Flashcard
  readonly flashcardMap = signal<Map<string, Flashcard>>(new Map());
  readonly allFlashcards = signal<Flashcard[]>([]);
  readonly dueReviews = signal<Flashcard[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly isDegraded = signal<boolean>(false);
  readonly degradedReason = signal<string>('');

  /** Cards queued for a deck-specific review session */
  readonly pendingReviewCards = signal<Flashcard[]>([]);

  /** Whether the device is currently offline (used for UI indicators) */
  readonly isOffline = computed(() => this.srsOffline.online() === false);

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`,
    };
  }

  async loadAllFlashcards(): Promise<void> {
    this.isLoading.set(true);
    try {
      const list = await firstValueFrom(
        this.http.get<Flashcard[]>(this.flashcardsUrl, { headers: this.getHeaders() }),
      );
      const sanitised = list.map((fc) => this.sanitiseFlashcard(fc));
      this.allFlashcards.set(sanitised);
      const map = new Map<string, Flashcard>();
      sanitised.forEach((fc) => map.set(fc.word_token.toLowerCase(), fc));
      this.flashcardMap.set(map);
      // Cache for offline access
      this.srsOffline.cacheFlashcards(sanitised).catch(() => undefined);
    } catch (e) {
      // Report error for crash tracking
      this.reportSrsError('loadAllFlashcards', e);
      // Offline fallback - serve from local cache
      if (this.srsOffline.online() === false) {
        const cached = await this.srsOffline.getCachedFlashcards();
        if (cached.length > 0) {
          const sanitised = cached.map((fc) => this.sanitiseFlashcard(fc));
          this.allFlashcards.set(sanitised);
          const map = new Map<string, Flashcard>();
          sanitised.forEach((fc) => map.set(fc.word_token.toLowerCase(), fc));
          this.flashcardMap.set(map);
        }
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadDueReviews(): Promise<void> {
    try {
      const list = await firstValueFrom(
        this.http.get<Flashcard[]>(`${this.flashcardsUrl}/due`, { headers: this.getHeaders() }),
      );
      const sanitised = list.map((fc) => this.sanitiseFlashcard(fc));
      this.dueReviews.set(sanitised);
      // Cache for offline access
      this.srsOffline.cacheDueReviews(sanitised).catch(() => undefined);
    } catch (e) {
      // Report error for crash tracking
      this.reportSrsError('loadDueReviews', e);
      // Offline fallback
      if (this.srsOffline.online() === false) {
        const cached = await this.srsOffline.getCachedDueReviews();
        if (cached.length > 0) {
          const sanitised = cached.map((fc) => this.sanitiseFlashcard(fc));
          this.dueReviews.set(sanitised);
        }
      }
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
      // Level 0 = New / secondary accent
      const cls =
        'bg-secondary/20 text-secondary border-b-2 border-secondary cursor-pointer hover:bg-secondary/30';
      return { level: 0, colorClass: cls, colourClass: cls };
    }
    if (fc.srs_level >= 4) {
      // Level 4+ = Known / normal text appearance
      const cls = 'text-text-primary  cursor-pointer hover:underline';
      return { level: fc.srs_level, colorClass: cls, colourClass: cls, flashcard: fc };
    }
    // Level 1 to 3 = Learning / warning accent
    const cls =
      'bg-warning/20 text-warning border-b-2 border-warning cursor-pointer hover:bg-warning/30 font-medium';
    return { level: fc.srs_level, colorClass: cls, colourClass: cls, flashcard: fc };
  }

  async saveWord(payload: {
    word_token: string;
    translation: string;
    original_context?: string;
    definition?: string;
    pronunciation_url?: string;
  }): Promise<Flashcard> {
    const sanitisedPayload = {
      word_token: this.sanitisation.sanitiseText(payload.word_token),
      translation: this.sanitisation.sanitiseText(payload.translation),
      original_context: payload.original_context
        ? this.sanitisation.sanitiseText(payload.original_context)
        : undefined,
      definition: payload.definition
        ? this.sanitisation.sanitiseText(payload.definition)
        : undefined,
      pronunciation_url: payload.pronunciation_url
        ? this.sanitisation.sanitiseUrl(payload.pronunciation_url)
        : undefined,
    };
    const fc = await firstValueFrom(
      this.http.post<Flashcard>(this.flashcardsUrl, sanitisedPayload, {
        headers: this.getHeaders(),
      }),
    );
    const sanitisedFc = this.sanitiseFlashcard(fc);
    this.allFlashcards.update((list) => {
      const filtered = list.filter(
        (item) => item.id !== sanitisedFc.id && item.word_token !== sanitisedFc.word_token,
      );
      return [sanitisedFc, ...filtered];
    });
    this.flashcardMap.update((map) => {
      const next = new Map(map);
      next.set(sanitisedFc.word_token.toLowerCase(), sanitisedFc);
      return next;
    });
    return sanitisedFc;
  }

  async updateSrsLevel(flashcardId: string, quality: number): Promise<Flashcard> {
    // Compute new SRS level locally for offline queueing
    const current = this.allFlashcards().find((f) => f.id === flashcardId);
    const newLevel = current ? this.estimateNewLevel(current.srs_level, quality) : 0;

    try {
      const fc = await firstValueFrom(
        this.http.patch<Flashcard>(
          `${this.flashcardsUrl}/${flashcardId}/srs`,
          { quality },
          { headers: this.getHeaders() },
        ),
      );
      const sanitisedFc = this.sanitiseFlashcard(fc);
      this.triggerHapticFeedback(sanitisedFc.srs_level);
      this.allFlashcards.update((list) =>
        list.map((item) => (item.id === sanitisedFc.id ? sanitisedFc : item)),
      );
      this.flashcardMap.update((map) => {
        const next = new Map(map);
        next.set(sanitisedFc.word_token.toLowerCase(), sanitisedFc);
        return next;
      });
      return sanitisedFc;
    } catch {
      // Offline - queue the review and optimistically update local state
      if (this.srsOffline.online() === false) {
        await this.srsOffline.queueSrsReview(flashcardId, quality, newLevel);
        this.triggerHapticFeedback(newLevel);
        // Optimistically update local state
        this.allFlashcards.update((list) =>
          list.map((item) => (item.id === flashcardId ? { ...item, srs_level: newLevel } : item)),
        );
        this.flashcardMap.update((map) => {
          const next = new Map(map);
          const card = next.get(current?.word_token?.toLowerCase() ?? '');
          if (card) {
            next.set(card.word_token.toLowerCase(), { ...card, srs_level: newLevel });
          }
          return next;
        });
        // Return the optimistically updated card
        const updated = this.allFlashcards().find((f) => f.id === flashcardId);
        if (updated) return updated;
      }
      throw new Error('Failed to update SRS level');
    }
  }

  /**
   * Estimate the new SRS level based on quality for offline use.
   * SM-2 approximation used locally.
   */
  private estimateNewLevel(currentLevel: number, quality: number): number {
    if (quality < 3) return 0;
    if (quality >= 4 && currentLevel >= 3) return 4;
    return Math.min(4, currentLevel + 1);
  }

  /**
   * Sync any queued offline SRS reviews to the server.
   */
  async syncOfflineReviews(): Promise<{ synced: number; failed: number }> {
    return this.srsOffline.syncQueuedReviews(async (item) => {
      await firstValueFrom(
        this.http.patch<Flashcard>(
          `${this.flashcardsUrl}/${item.flashcardId}/srs`,
          { quality: item.quality },
          { headers: this.getHeaders() },
        ),
      );
    });
  }

  // NLP API calls
  async translateWordOrSentence(
    text: string,
    targetLang: string,
    sourceLang?: string,
  ): Promise<TranslationResult> {
    try {
      return await firstValueFrom(
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
    } catch {
      this.isDegraded.set(true);
      return {
        original_text: text,
        translated_text: text,
        detected_language: sourceLang ?? 'unknown',
        definition: 'Translation service is currently unavailable',
      };
    }
  }

  async checkGrammar(text: string, language?: string): Promise<GrammarCheckResult> {
    try {
      return await firstValueFrom(
        this.http.post<GrammarCheckResult>(
          `${this.nlpUrl}/grammar-check`,
          { text, language },
          { headers: this.getHeaders() },
        ),
      );
    } catch {
      this.isDegraded.set(true);
      return {
        original: text,
        corrected: text,
        explanation: 'Grammar check is currently unavailable',
        errors_found: 0,
      };
    }
  }

  async scorePronunciation(
    audioUrl: string,
    targetText: string,
    language?: string,
  ): Promise<PronunciationScoreResult> {
    try {
      return await firstValueFrom(
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
    } catch {
      this.isDegraded.set(true);
      return {
        overall_score: 85,
        breakdown: [{ word: targetText, score: 85 }],
        feedback_summary: 'Pronunciation scoring is currently unavailable',
      };
    }
  }

  /**
   * Reports SRS-related errors through the global error handler with context metadata.
   * Replaces console.error so all SRS failures are tracked centrally.
   */
  private reportSrsError(operation: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    const srsError = new SrsOperationError(
      `[SRS:VocabularyStore] ${operation} failed: ${message}`,
      operation,
      err instanceof Error ? err.stack : undefined,
    );
    this.errorHandler.handleError(srsError);
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
