import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { SrsOfflineService } from './srs-offline.service';
import type { Flashcard } from './vocabulary.store';

export interface CreateFlashcardDto {
  word_token: string;
  original_context?: string;
  translation: string;
  definition?: string;
  pronunciation_url?: string;
}

export interface UpdateSrsDto {
  quality: number;
}

export interface SrsHealthStatus {
  healthy: boolean;
  mode: 'full' | 'degraded';
  degradedServices: string[];
  lastSuccessfulSync: string | null;
  cacheStats: {
    cachedFlashcardCount: number;
    pendingSyncCount: number;
  };
}

@Injectable({ providedIn: 'root' })
export class FlashcardService {
  private http = inject(HttpClient);
  private srsOffline = inject(SrsOfflineService);
  private baseUrl = `${environment.apiUrl}/flashcards`;

  private degraded = false;

  get isDegraded(): boolean {
    return this.degraded;
  }

  private checkDegradedHeader(response: HttpResponse<unknown>): boolean {
    const header = response.headers.get('X-SRS-Degraded');
    const isDegraded = header === 'true';
    if (isDegraded) {
      this.degraded = true;
    }
    return isDegraded;
  }

  async getHealth(): Promise<SrsHealthStatus> {
    try {
      const result = await firstValueFrom(this.http.get<SrsHealthStatus>(`${this.baseUrl}/health`));
      this.degraded = result.mode === 'degraded';
      return result;
    } catch {
      return {
        healthy: false,
        mode: 'degraded',
        degradedServices: ['api-unreachable'],
        lastSuccessfulSync: null,
        cacheStats: {
          cachedFlashcardCount: 0,
          pendingSyncCount: 0,
        },
      };
    }
  }

  async createFlashcard(dto: CreateFlashcardDto): Promise<Flashcard> {
    try {
      const result = await firstValueFrom(
        this.http.post<Flashcard>(this.baseUrl, dto, { observe: 'response' }),
      );
      this.checkDegradedHeader(result);
      const card = result.body!;
      // Cache the result for offline use
      void this.srsOffline.cacheFlashcards([card]);
      return card;
    } catch {
      // Offline: create a locally generated flashcard
      const degradedCard: Flashcard = {
        id: `offline-${Date.now()}-${crypto.randomUUID()}`,
        user_id: '',
        word_token: dto.word_token,
        original_context: dto.original_context,
        translation: dto.translation ?? '',
        srs_level: 0,
        easiness_factor: 2.5,
        repetitions: 0,
        interval_days: 0,
        next_review_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      void this.srsOffline.cacheFlashcards([degradedCard]);
      this.degraded = true;
      return degradedCard;
    }
  }

  async updateSrsLevel(flashcardId: string, quality: number): Promise<Flashcard> {
    try {
      const result = await firstValueFrom(
        this.http.patch<Flashcard>(
          `${this.baseUrl}/${flashcardId}/srs`,
          { quality } as UpdateSrsDto,
          { observe: 'response' },
        ),
      );
      this.checkDegradedHeader(result);
      const card = result.body!;
      void this.srsOffline.cacheFlashcards([card]);
      return card;
    } catch {
      // Queue the review for later sync and return estimated local state
      this.degraded = true;
      void this.srsOffline.queueSrsReview(flashcardId, quality, 1);
      return {
        id: flashcardId,
        user_id: '',
        word_token: '',
        translation: '',
        srs_level: 1,
        easiness_factor: 2.5,
        repetitions: 1,
        interval_days: 1,
        next_review_at: new Date(Date.now() + 86400000).toISOString(),
        created_at: new Date().toISOString(),
      };
    }
  }

  async getFlashcards(level?: number): Promise<Flashcard[]> {
    try {
      const params: Record<string, string> = {};
      if (level !== undefined) {
        params['level'] = String(level);
      }
      const result = await firstValueFrom(
        this.http.get<Flashcard[]>(this.baseUrl, {
          params,
          observe: 'response',
        }),
      );
      this.checkDegradedHeader(result);
      const cards = result.body ?? [];
      // Cache for offline use
      void this.srsOffline.cacheFlashcards(cards);
      return cards;
    } catch {
      this.degraded = true;
      return this.srsOffline.getCachedFlashcards();
    }
  }

  async getDueReviews(): Promise<Flashcard[]> {
    try {
      const result = await firstValueFrom(
        this.http.get<Flashcard[]>(`${this.baseUrl}/due`, {
          observe: 'response',
        }),
      );
      this.checkDegradedHeader(result);
      const cards = result.body ?? [];
      void this.srsOffline.cacheDueReviews(cards);
      return cards;
    } catch {
      this.degraded = true;
      return this.srsOffline.getCachedDueReviews();
    }
  }

  /**
   * Synchronises any queued offline reviews with the server.
   * Call this when the app detects network connectivity has been restored.
   */
  async syncOfflineReviews(): Promise<{ synced: number; failed: number }> {
    return this.srsOffline.syncQueuedReviews(async (item) => {
      await firstValueFrom(
        this.http.patch(`${this.baseUrl}/${item.flashcardId}/srs`, {
          quality: item.quality,
        } as UpdateSrsDto),
      );
    });
  }
}
