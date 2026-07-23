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
  providedIn: 'root'
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

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`
    };
  }

  async loadAllFlashcards(): Promise<void> {
    this.isLoading.set(true);
    try {
      const list = await firstValueFrom(
        this.http.get<Flashcard[]>(this.flashcardsUrl, { headers: this.getHeaders() })
      );
      this.allFlashcards.set(list);
      const map = new Map<string, Flashcard>();
      list.forEach(fc => map.set(fc.word_token.toLowerCase(), fc));
      this.flashcardMap.set(map);
    } catch (e) {
      console.error('Failed to load flashcards:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadDueReviews(): Promise<void> {
    try {
      const list = await firstValueFrom(
        this.http.get<Flashcard[]>(`${this.flashcardsUrl}/due`, { headers: this.getHeaders() })
      );
      this.dueReviews.set(list);
    } catch (e) {
      console.error('Failed to load due reviews:', e);
    }
  }

  getWordStatus(word: string): { level: number; colorClass: string; colourClass: string; flashcard?: Flashcard } {
    const clean = word.toLowerCase().trim();
    const fc = this.flashcardMap().get(clean);
    if (!fc) {
      // Level 0 = New / Blue
      const cls = 'bg-blue-500/20 text-blue-900 border-b-2 border-blue-400 cursor-pointer hover:bg-blue-200';
      return { level: 0, colorClass: cls, colourClass: cls };
    }
    if (fc.srs_level >= 4) {
      // Level 4+ = Known / White (normal text appearance)
      const cls = 'text-text-primary  cursor-pointer hover:underline';
      return { level: fc.srs_level, colorClass: cls, colourClass: cls, flashcard: fc };
    }
    // Level 1 to 3 = Learning / Yellow
    const cls = 'bg-amber-500/20 text-amber-400 border-b-2 border-amber-500 cursor-pointer hover:bg-amber-200 font-medium';
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
      this.http.post<Flashcard>(this.flashcardsUrl, payload, { headers: this.getHeaders() })
    );
    this.allFlashcards.update(list => {
      const filtered = list.filter(item => item.id !== fc.id && item.word_token !== fc.word_token);
      return [fc, ...filtered];
    });
    this.flashcardMap.update(map => {
      const next = new Map(map);
      next.set(fc.word_token.toLowerCase(), fc);
      return next;
    });
    return fc;
  }

  async updateSrsLevel(flashcardId: string, level: number): Promise<Flashcard> {
    const fc = await firstValueFrom(
      this.http.patch<Flashcard>(`${this.flashcardsUrl}/${flashcardId}/srs`, { srs_level: level }, { headers: this.getHeaders() })
    );
    this.allFlashcards.update(list => list.map(item => item.id === fc.id ? fc : item));
    this.flashcardMap.update(map => {
      const next = new Map(map);
      next.set(fc.word_token.toLowerCase(), fc);
      return next;
    });
    return fc;
  }

  // NLP API calls
  async translateWordOrSentence(text: string, targetLang: string, sourceLang?: string): Promise<TranslationResult> {
    return firstValueFrom(
      this.http.post<TranslationResult>(`${this.nlpUrl}/translate`, {
        text,
        target_language: targetLang,
        source_language: sourceLang
      }, { headers: this.getHeaders() })
    );
  }

  async checkGrammar(text: string, language?: string): Promise<GrammarCheckResult> {
    return firstValueFrom(
      this.http.post<GrammarCheckResult>(`${this.nlpUrl}/grammar-check`, { text, language }, { headers: this.getHeaders() })
    );
  }

  async scorePronunciation(audioUrl: string, targetText: string, language?: string): Promise<PronunciationScoreResult> {
    return firstValueFrom(
      this.http.post<PronunciationScoreResult>(`${this.nlpUrl}/pronunciation-score`, {
        audio_url: audioUrl,
        target_text: targetText,
        language
      }, { headers: this.getHeaders() })
    );
  }
}
