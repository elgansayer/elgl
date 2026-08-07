import { Injectable, inject, signal, computed, ErrorHandler } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { SrsOfflineService } from './srs-offline.service';
import { SrsCircuitBreakerService } from './srs-circuit-breaker.service';
import { HtmlSanitisationService } from './html-sanitisation.service';

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
  private circuitBreaker = inject(SrsCircuitBreakerService);
  private errorHandler = inject(ErrorHandler);
  private htmlSanitiser = inject(HtmlSanitisationService);
  private flashcardsUrl = `${environment.apiUrl}/flashcards`;
  private nlpUrl = `${environment.apiUrl}/nlp`;

  /** Maximum number of flashcards to fetch in a single page load. */
  private static readonly FLASHCARDS_PAGE_SIZE = 50;

  // Reactive state map of word_token -> Flashcard
  readonly flashcardMap = signal<Map<string, Flashcard>>(new Map());
  readonly allFlashcards = signal<Flashcard[]>([]);
  readonly dueReviews = signal<Flashcard[]>([]);
  readonly isLoading = signal<boolean>(false);
  /** True when there are more flashcards to load from the server. */
  readonly hasMoreFlashcards = signal<boolean>(true);
  /** Current page offset for paginated flashcard loading. */
  private flashcardPage = 0;

  /** Whether the SRS backend is in a degraded state (circuit breaker open or unreachable) */
  readonly isDegraded = signal(false);
  /** Human-readable reason for the current degraded state */
  readonly degradedReason = signal('');

  /** Cards queued for a deck-specific review session */
  readonly pendingReviewCards = signal<Flashcard[]>([]);

  /** Whether the device is currently offline (used for UI indicators) */
  readonly isOffline = computed(() => !navigator.onLine);

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`,
    };
  }

  /**
   * Load the first page of flashcards. Use {@link loadMoreFlashcards} to load
   * subsequent pages in a paginated fashion.
   */
  async loadAllFlashcards(): Promise<void> {
    this.isLoading.set(true);
    const degradedCtx = { degraded: false, reason: '' };

    await this.circuitBreaker.executeWithBreaker(
      'srs-flashcards-list',
      async () => {
        const params = new URLSearchParams();
        params.set('limit', String(VocabularyStore.FLASHCARDS_PAGE_SIZE));
        params.set('offset', '0');
        const list = await firstValueFrom(
          this.http.get<Flashcard[]>(`${this.flashcardsUrl}?${params.toString()}`, {
            headers: this.getHeaders(),
          }),
        );
        const sanitised = this.sanitiseFlashcards(list);
        this.allFlashcards.set(sanitised);
        this.flashcardPage = 0;
        this.hasMoreFlashcards.set(sanitised.length >= VocabularyStore.FLASHCARDS_PAGE_SIZE);
        const map = new Map<string, Flashcard>();
        sanitised.forEach((fc) => map.set(fc.word_token.toLowerCase(), fc));
        this.flashcardMap.set(map);
        // Cache for offline access
        this.srsOffline.cacheFlashcards(sanitised).catch(() => undefined);
        this.isDegraded.set(false);
        this.degradedReason.set('');
      },
      async () => {
        // Graceful degradation: serve from local cache
        this.reportSrsError('loadAllFlashcards', new Error(degradedCtx.reason || 'Circuit breaker / network error'));
        const cached = await this.srsOffline.getCachedFlashcards();
        if (cached.length > 0) {
          const sanitised = this.sanitiseFlashcards(cached);
          this.allFlashcards.set(sanitised);
          this.hasMoreFlashcards.set(false);
          const map = new Map<string, Flashcard>();
          sanitised.forEach((fc) => map.set(fc.word_token.toLowerCase(), fc));
          this.flashcardMap.set(map);
        }
        this.isDegraded.set(true);
        this.degradedReason.set(degradedCtx.reason || 'Flashcard data may be stale');
      },
      degradedCtx,
    );

    this.isLoading.set(false);
  }

  /**
   * Load the next page of flashcards and append to the existing list.
   * Returns the number of newly loaded cards (0 if no more pages).
   */
  async loadMoreFlashcards(): Promise<number> {
    if (!this.hasMoreFlashcards() || this.isLoading()) return 0;
    this.isLoading.set(true);
    const nextPage = this.flashcardPage + 1;
    try {
      const params = new URLSearchParams();
      params.set('limit', String(VocabularyStore.FLASHCARDS_PAGE_SIZE));
      params.set('offset', String(nextPage * VocabularyStore.FLASHCARDS_PAGE_SIZE));
      const list = await firstValueFrom(
        this.http.get<Flashcard[]>(`${this.flashcardsUrl}?${params.toString()}`, {
          headers: this.getHeaders(),
        }),
      );
      const sanitised = this.sanitiseFlashcards(list);
      if (sanitised.length === 0) {
        this.hasMoreFlashcards.set(false);
        return 0;
      }
      this.flashcardPage = nextPage;
      this.hasMoreFlashcards.set(sanitised.length >= VocabularyStore.FLASHCARDS_PAGE_SIZE);
      this.allFlashcards.update((prev) => [...prev, ...sanitised]);
      this.flashcardMap.update((prevMap) => {
        const next = new Map(prevMap);
        sanitised.forEach((fc) => next.set(fc.word_token.toLowerCase(), fc));
        return next;
      });
      // Cache combined set for offline access
      this.srsOffline.cacheFlashcards(this.allFlashcards()).catch(() => undefined);
      return sanitised.length;
    } catch (e) {
      this.reportSrsError('loadMoreFlashcards', e);
      return 0;
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Resets pagination state and clears the local flashcard store. */
  resetFlashcardPagination(): void {
    this.flashcardPage = 0;
    this.hasMoreFlashcards.set(true);
    this.allFlashcards.set([]);
    this.flashcardMap.set(new Map());
  }

  async loadDueReviews(): Promise<void> {
    const degradedCtx = { degraded: false, reason: '' };

    await this.circuitBreaker.executeWithBreaker(
      'srs-due-reviews',
      async () => {
        const list = await firstValueFrom(
          this.http.get<Flashcard[]>(`${this.flashcardsUrl}/due`, { headers: this.getHeaders() }),
        );
        const sanitised = this.sanitiseFlashcards(list);
        this.dueReviews.set(sanitised);
        this.srsOffline.cacheDueReviews(sanitised).catch(() => undefined);
      },
      async () => {
        this.reportSrsError('loadDueReviews', new Error(degradedCtx.reason || 'Circuit breaker / network error'));
        const cached = await this.srsOffline.getCachedDueReviews();
        if (cached.length > 0) {
          this.dueReviews.set(this.sanitiseFlashcards(cached));
        }
        this.isDegraded.set(true);
        this.degradedReason.set(degradedCtx.reason || 'Due reviews may be stale');
      },
      degradedCtx,
    );
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
    const sanitised = this.sanitiseFlashcard(fc);
    this.allFlashcards.update((list) => {
      const filtered = list.filter(
        (item) => item.id !== sanitised.id && item.word_token !== sanitised.word_token,
      );
      return [sanitised, ...filtered];
    });
    this.flashcardMap.update((map) => {
      const next = new Map(map);
      next.set(sanitised.word_token.toLowerCase(), sanitised);
      return next;
    });
    return sanitised;
  }

  async updateSrsLevel(flashcardId: string, quality: number): Promise<Flashcard> {
    // Compute new SRS level locally for offline queueing
    const current = this.allFlashcards().find((f) => f.id === flashcardId);
    const newLevel = current ? this.estimateNewLevel(current.srs_level, quality) : 0;

    const degradedCtx = { degraded: false, reason: '' };

    return this.circuitBreaker.executeWithBreaker(
      'srs-update-level',
      async () => {
        const fc = await firstValueFrom(
          this.http.patch<Flashcard>(
            `${this.flashcardsUrl}/${flashcardId}/srs`,
            { quality },
            { headers: this.getHeaders() },
          ),
        );
        const sanitised = this.sanitiseFlashcard(fc);
        this.triggerHapticFeedback(sanitised.srs_level);
        this.allFlashcards.update((list) => list.map((item) => (item.id === sanitised.id ? sanitised : item)));
        this.flashcardMap.update((map) => {
          const next = new Map(map);
          next.set(sanitised.word_token.toLowerCase(), sanitised);
          return next;
        });
        return sanitised;
      },
      async () => {
        // Graceful degradation: queue offline and optimistically update
        this.reportSrsError('updateSrsLevel', new Error(degradedCtx.reason || 'Circuit breaker / network error'));
        await this.srsOffline.queueSrsReview(flashcardId, quality, newLevel);
        this.triggerHapticFeedback(newLevel);
        // Optimistically update local state
        this.allFlashcards.update((list) =>
          list.map((item) =>
            item.id === flashcardId ? { ...item, srs_level: newLevel } : item,
          ),
        );
        this.flashcardMap.update((map) => {
          const next = new Map(map);
          const card = next.get(current?.word_token?.toLowerCase() ?? '');
          if (card) {
            next.set(card.word_token.toLowerCase(), { ...card, srs_level: newLevel });
          }
          return next;
        });
        this.isDegraded.set(true);
        this.degradedReason.set(degradedCtx.reason || 'Review queued offline');
        // Return the optimistically updated card
        const updated = this.allFlashcards().find((f) => f.id === flashcardId);
        if (!updated) throw new Error('Failed to update SRS level - card not found');
        return updated;
      },
      degradedCtx,
    );
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
    return this.srsOffline.syncQueuedReviews(async (queued) => {
      await firstValueFrom(
        this.http.patch<Flashcard>(
          `${this.flashcardsUrl}/${queued.flashcardId}/srs`,
          { quality: queued.quality },
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
    } catch (e) {
      this.reportSrsError('translateWordOrSentence', e);
      // Graceful degradation: return a local fallback result when NLP backend is unreachable
      return {
        original_text: text,
        translated_text: text,
        detected_language: sourceLang ?? 'en',
        definition: `Word: "${text}" (translation service temporarily unavailable)`,
        transliteration: text,
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
    } catch (e) {
      this.reportSrsError('checkGrammar', e);
      // Graceful degradation: return a local fallback result
      return {
        original: text,
        corrected: text,
        explanation: 'Grammar checking service is temporarily unavailable.',
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
    } catch (e) {
      this.reportSrsError('scorePronunciation', e);
      // Graceful degradation: return estimated scores when pronunciation service is unavailable
      const words = targetText.split(/\s+/).filter((w) => w.length > 0);
      return {
        overall_score: 85,
        breakdown: words.map((w) => ({ word: w, score: 85, feedback: 'Pronunciation assessment unavailable' })),
        feedback_summary: 'Pronunciation scoring is temporarily unavailable. Keep practising!',
      };
    }
  }

  /**
   * Reports SRS-related errors through the global error handler with context metadata.
   * Replaces console.error so all SRS failures are tracked centrally.
   */
  private reportSrsError(operation: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    const srsError = new Error(
      `[SRS:VocabularyStore] ${operation} failed: ${message}`,
    );
    srsError.name = 'SrsOperationError';
    if (err instanceof Error && err.stack) {
      srsError.stack = err.stack;
    }
    const enriched = Object.assign(srsError, { srsOperation: operation });
    this.errorHandler.handleError(enriched);
  }

  /**
   * Sanitises a single flashcard's text fields against XSS via DOMPurify.
   * Only runs on the user-authored text fields (word_token, translation,
   * definition, original_context, pronunciation_url).
   */
  private sanitiseFlashcard(fc: Flashcard): Flashcard {
    return {
      ...fc,
      word_token: this.htmlSanitiser.sanitiseText(fc.word_token),
      translation: this.htmlSanitiser.sanitiseText(fc.translation),
      definition: fc.definition
        ? this.htmlSanitiser.sanitiseText(fc.definition)
        : fc.definition,
      original_context: fc.original_context
        ? this.htmlSanitiser.sanitiseText(fc.original_context)
        : fc.original_context,
      pronunciation_url: fc.pronunciation_url
        ? this.htmlSanitiser.sanitiseUrl(fc.pronunciation_url)
        : fc.pronunciation_url,
    };
  }

  /** Sanitises an array of flashcards. */
  private sanitiseFlashcards(list: Flashcard[]): Flashcard[] {
    return list.map((fc) => this.sanitiseFlashcard(fc));
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
