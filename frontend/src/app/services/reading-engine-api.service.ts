import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';

export interface ReadingResource {
  id: string;
  title: string;
  content: string;
  language: string;
  difficulty?: string;
  topic?: string;
  sourceUrl?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingTokenBreakdown {
  resourceId: string;
  language: string;
  totalTokens: number;
  uniqueTokens: number;
  tokens: Array<{
    index: number;
    token: string;
    position: number;
    isWordLike: boolean;
  }>;
}

export interface ReadingProgress {
  userId: string;
  wordsRead: number;
  articlesCompleted: number;
  totalReadingTimeSeconds: number;
  fluencyPercentage: number;
  lastReadAt?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class ReadingEngineApiService {
  private api = inject(ApiService);
  private readonly baseUrl = `${environment.apiUrl}/reading`;

  async getResources(filters?: {
    language?: string;
    difficulty?: string;
    topic?: string;
    limit?: number;
    offset?: number;
  }): Promise<ReadingResource[]> {
    const params: Record<string, string | number> = {};
    if (filters?.language) params['language'] = filters.language;
    if (filters?.difficulty) params['difficulty'] = filters.difficulty;
    if (filters?.topic) params['topic'] = filters.topic;
    if (filters?.limit) params['limit'] = filters.limit;
    if (filters?.offset) params['offset'] = filters.offset;

    return this.api.get<ReadingResource[]>(`${this.baseUrl}/resources`, {
      params,
      fallback: [],
      requireAuth: true,
    });
  }

  async getResource(id: string): Promise<ReadingResource | null> {
    try {
      return await this.api.get<ReadingResource>(`${this.baseUrl}/resources/${id}`, {
        requireAuth: true,
      });
    } catch {
      return null;
    }
  }

  async tokenise(id: string, lang?: string): Promise<ReadingTokenBreakdown | null> {
    const params: Record<string, string> = {};
    if (lang) params['lang'] = lang;

    try {
      return await this.api.get<ReadingTokenBreakdown>(`${this.baseUrl}/resources/${id}/tokenise`, {
        params,
        requireAuth: true,
      });
    } catch {
      return null;
    }
  }

  async getProgress(): Promise<ReadingProgress | null> {
    try {
      return await this.api.get<ReadingProgress>(`${this.baseUrl}/progress`, {
        requireAuth: true,
      });
    } catch {
      return null;
    }
  }

  async recordSession(data: {
    resourceId: string;
    wordsRead: number;
    durationSeconds: number;
  }): Promise<ReadingProgress | null> {
    try {
      return await this.api.post<ReadingProgress>(`${this.baseUrl}/progress/session`, data, {
        requireAuth: true,
      });
    } catch {
      return null;
    }
  }
}
