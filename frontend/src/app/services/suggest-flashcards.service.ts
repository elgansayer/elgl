import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { lastValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

export interface SuggestResult {
  suggestions: string[];
}

@Injectable({ providedIn: 'root' })
export class SuggestFlashcardsService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private baseUrl = `${environment.apiUrl}/flashcards/suggest`;

  async suggestFromMessage(
    message: string,
    targetLanguage?: string,
    excludeKnown = true,
    maxResults?: number,
  ): Promise<SuggestResult> {
    let params = new HttpParams()
      .set('message', message)
      .set('exclude_known', String(excludeKnown));
    if (targetLanguage) params = params.set('target_language', targetLanguage);
    if (maxResults !== undefined) params = params.set('max_results', String(maxResults));

    const token = this.authService.getAccessToken();
    const headers = new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` });

    const result$ = this.http.get<SuggestResult>(this.baseUrl, { params, headers });
    return lastValueFrom(result$);
  }
}
