import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface VocabularyEntry {
  interestTag: string;
  vocabWord: string;
  translation: string | null;
  srsLevel: number;
}

@Injectable({ providedIn: 'root' })
export class UserInterestsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/user-interests';

  getUserTags(): Promise<string[]> {
    return firstValueFrom(
      this.http.get<{ tags: string[] }>(`${this.baseUrl}/tags`),
    ).then((r) => r.tags);
  }

  updateUserTags(tags: string[]): Promise<void> {
    return firstValueFrom(
      this.http.post(`${this.baseUrl}/tags`, { tags }),
    ).then(() => undefined);
  }

  getVocabulary(language: string): Promise<VocabularyEntry[]> {
    return firstValueFrom(
      this.http.get<{ entries: VocabularyEntry[] }>(
        `${this.baseUrl}/vocabulary`,
        { params: { language } },
      ),
    ).then((r) => r.entries);
  }
}
