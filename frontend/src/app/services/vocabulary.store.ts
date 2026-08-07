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

/** SM-2 algorithm result for local SRS computation */
export interface Sm2Result {
  newEf: number;
  newRepetitions: number;
  newInterval: number;
  newSrsLevel: number;
}

const MOCK_FALLBACK_FLASHCARDS: Flashcard[] = [
  {
    id: 'mock-fc-1',
    user_id: 'local-user',
    word_token: 'abundant',
    original_context: 'The rainforest has an abundant variety of species.',
    translation: 'abundant',
    definition: 'existing or available in large quantities; plentiful',
    pronunciation_url: undefined,
    srs_level: 1,
    easiness_factor: 2.5,
    repetitions: 1,
    interval_days: 3,
    next_review_at: new Date(Date.now() - 3600000).toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'mock-fc-2',
    user_id: 'local-user',
    word_token: 'ephemeral',
    original_context: 'The beauty of cherry blossoms is ephemeral.',
    translation: 'ephemeral',
    definition: 'lasting for a very short time',
    pronunciation_url: undefined,
    srs_level: 2,
    easiness_factor: 2.6,
    repetitions: 2,
    interval_days: 7,
    next_review_at: new Date(Date.now() + 86400000).toISOString(),
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'mock-fc-3',
    user_id: 'local-user',
    word_token: 'serendipity',
    original_context: 'Finding that book was pure serendipity.',
    translation: 'serendipity',
    definition: 'the occurrence of events by chance in a happy way',
    pronunciation_url: undefined,
    srs_level: 3,
    easiness_factor: 2.7,
    repetitions: 3,
    interval_days: 14,
    next_review_at: new Date(Date.now() - 7200000).toISOString(),
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: 'mock-fc-4',
    user_id: 'local-user',
    word_token: 'eloquent',
    original_context: 'She gave an eloquent speech at the ceremony.',
    translation: 'eloquent',
    definition: 'fluent or persuasive in speaking or writing',
    pronunciation_url: undefined,
    srs_level: 0,
    easiness_factor: 2.5,
    repetitions: 0,
    interval_days: 0,
    next_review_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: 'mock-fc-5',
    user_id: 'local-user',
    word_token: 'nostalgia',
    original_context: 'The old song filled her with nostalgia.',
    translation: 'nostalgia',
    definition: 'a sentimental longing for the past',
    pronunciation_url: undefined,
    srs_level: 4,
    easiness_factor: 2.9,
    repetitions: 5,
    interval_days: 30,
    next_review_at: new Date(Date.now() + 604800000).toISOString(),
    created_at: new Date(Date.now() - 604800000).toISOString(),
  },
];

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

  /** Cards queued for a deck-specific review session */
  readonly pendingReviewCards = signal<Flashcard[]>([]);
  /** Whether the store is operating in offline/fallback mode */
  readonly isOfflineMode = signal<boolean>(false);

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`,
    };
  }

  /** Exposed SM-2 algorithm for components to use locally as fallback */
  applySm2Algorithm(
    quality: number,
    ef: number,
    repetitions: number,
    interval: number,
  ): Sm2Result {
    const q = Math.max(0, Math.min(5, quality));
    const newEf = Number(
      Math.max(1.3, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))).toFixed(4),
    );

    let newRepetitions: number;
    let newInterval: number;

    if (q < 3) {
      newRepetitions = 0;
      newInterval = 1;
    } else {
      if (repetitions === 0) {
        newInterval = 1;
      } else if (repetitions === 1) {
        newInterval = 6;
      } else {
        newInterval = Math.round(interval * newEf);
      }
      newRepetitions = repetitions + 1;
    }

    let newSrsLevel: number;
    if (newRepetitions === 0) {
      newSrsLevel = 0;
    } else if (newRepetitions === 1) {
      newSrsLevel = 1;
    } else if (newRepetitions === 2) {
      newSrsLevel = 2;
    } else if (newInterval < 21) {
      newSrsLevel = 3;
    } else {
      newSrsLevel = 4;
    }

    return { newEf, newRepetitions, newInterval, newSrsLevel };
  }

  /** Quality (0-5) to review grade mapping for components */
  gradeToQuality(grade: 'again' | 'good' | 'known'): number {
    switch (grade) {
      case 'again': return 0;
      case 'good': return 3;
      case 'known': return 5;
    }
  }

  private getFallbackFlashcards(): Flashcard[] {
    const userId = this.authService.currentUser()?.id ?? 'local-user';
    return MOCK_FALLBACK_FLASHCARDS.map((fc) => ({
      ...fc,
      user_id: userId,
    }));
  }

  private getFallbackDueReviews(): Flashcard[] {
    const now = new Date().toISOString();
    return this.getFallbackFlashcards()
      .filter((fc) => fc.srs_level < 4 && fc.next_review_at <= now)
      .sort(
        (a, b) =>
          new Date(a.next_review_at).getTime() -
          new Date(b.next_review_at).getTime(),
      );
  }

  async loadAllFlashcards(): Promise<void> {
    this.isLoading.set(true);
    try {
      const list = await firstValueFrom(
        this.http.get<Flashcard[]>(this.flashcardsUrl, { headers: this.getHeaders() }),
      );
      this.allFlashcards.set(list);
      this.isOfflineMode.set(false);
      const map = new Map<string, Flashcard>();
      list.forEach((fc) => map.set(fc.word_token.toLowerCase(), fc));
      this.flashcardMap.set(map);
    } catch {
      // Graceful degradation: use local fallback data
      const fallback = this.getFallbackFlashcards();
      this.allFlashcards.set(fallback);
      this.isOfflineMode.set(true);
      const map = new Map<string, Flashcard>();
      fallback.forEach((fc) => map.set(fc.word_token.toLowerCase(), fc));
      this.flashcardMap.set(map);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadDueReviews(): Promise<void> {
    try {
      const list = await firstValueFrom(
        this.http.get<Flashcard[]>(`${this.flashcardsUrl}/due`, { headers: this.getHeaders() }),
      );
      this.dueReviews.set(list);
      this.isOfflineMode.set(false);
    } catch {
      // Graceful degradation: use locally computed due cards
      this.dueReviews.set(this.getFallbackDueReviews());
      this.isOfflineMode.set(true);
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
    try {
      const fc = await firstValueFrom(
        this.http.post<Flashcard>(this.flashcardsUrl, payload, { headers: this.getHeaders() }),
      );
      this.isOfflineMode.set(false);
      this.updateCardInLocalState(fc);
      return fc;
    } catch {
      // Graceful degradation: locally construct a flashcard
      const fallbackCard: Flashcard = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        user_id: this.authService.currentUser()?.id ?? 'local-user',
        word_token: payload.word_token.toLowerCase().trim(),
        original_context: payload.original_context,
        translation: payload.translation,
        definition: payload.definition,
        pronunciation_url: payload.pronunciation_url,
        srs_level: 0,
        easiness_factor: 2.5,
        repetitions: 0,
        interval_days: 0,
        next_review_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      this.isOfflineMode.set(true);
      this.updateCardInLocalState(fallbackCard);
      return fallbackCard;
    }
  }

  async updateSrsLevel(flashcardId: string, quality: number): Promise<Flashcard> {
    try {
      const fc = await firstValueFrom(
        this.http.patch<Flashcard>(
          `${this.flashcardsUrl}/${flashcardId}/srs`,
          { quality },
          { headers: this.getHeaders() },
        ),
      );
      this.triggerHapticFeedback(fc.srs_level);
      this.isOfflineMode.set(false);
      this.updateCardInLocalState(fc);
      return fc;
    } catch {
      // Graceful degradation: compute SRS locally
      const existingCard = this.allFlashcards().find((c) => c.id === flashcardId);
      if (!existingCard) {
        const fallbackCards = this.getFallbackFlashcards();
        const fb = fallbackCards.find((c) => c.id === flashcardId);
        if (!fb) return fallbackCards[0];
        return fb;
      }

      const { newEf, newRepetitions, newInterval, newSrsLevel } =
        this.applySm2Algorithm(
          quality,
          existingCard.easiness_factor,
          existingCard.repetitions,
          existingCard.interval_days,
        );

      const nextReviewAt = new Date();
      nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);

      const updatedCard: Flashcard = {
        ...existingCard,
        srs_level: newSrsLevel,
        easiness_factor: newEf,
        repetitions: newRepetitions,
        interval_days: newInterval,
        next_review_at: nextReviewAt.toISOString(),
      };

      this.triggerHapticFeedback(updatedCard.srs_level);
      this.isOfflineMode.set(true);
      this.updateCardInLocalState(updatedCard);
      return updatedCard;
    }
  }

  private updateCardInLocalState(fc: Flashcard): void {
    this.allFlashcards.update((list) => {
      const existingIdx = list.findIndex((item) => item.id === fc.id);
      if (existingIdx >= 0) {
        return list.map((item) => (item.id === fc.id ? fc : item));
      }
      const filtered = list.filter(
        (item) => item.word_token !== fc.word_token,
      );
      return [fc, ...filtered];
    });
    this.flashcardMap.update((map) => {
      const next = new Map(map);
      next.set(fc.word_token.toLowerCase(), fc);
      return next;
    });
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
