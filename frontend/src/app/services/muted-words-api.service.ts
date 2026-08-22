import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

interface MutedWordsResponse {
  words: unknown;
}

@Injectable({ providedIn: 'root' })
export class MutedWordsApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/safety/muted-words`;

  private parseWords(response: MutedWordsResponse): string[] {
    if (!Array.isArray(response.words)) {
      throw new Error('Invalid muted words response');
    }

    const words: string[] = [];
    const seen = new Set<string>();
    for (const candidate of response.words) {
      if (typeof candidate !== 'string') continue;
      const normalised = candidate.normalize('NFKC').trim().toLowerCase();
      if (!normalised || normalised.length > 64 || seen.has(normalised)) continue;
      seen.add(normalised);
      words.push(normalised);
      if (words.length === 100) break;
    }
    return words;
  }

  async list(): Promise<string[]> {
    const response = await firstValueFrom(
      this.http.get<MutedWordsResponse>(this.endpoint),
    );
    return this.parseWords(response);
  }

  async add(word: string): Promise<string[]> {
    const response = await firstValueFrom(
      this.http.post<MutedWordsResponse>(this.endpoint, { word }),
    );
    return this.parseWords(response);
  }

  async remove(word: string): Promise<string[]> {
    const response = await firstValueFrom(
      this.http.delete<MutedWordsResponse>(this.endpoint, { body: { word } }),
    );
    return this.parseWords(response);
  }
}
