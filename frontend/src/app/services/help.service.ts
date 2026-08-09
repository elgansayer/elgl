import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

export interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export interface HelpQuery {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface HelpResult {
  items: FAQ[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({
  providedIn: 'root',
})
export class HelpService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl: string = `${environment.apiUrl}/help`;

  async fetchArticles(query: HelpQuery): Promise<HelpResult> {
    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('limit', String(query.limit ?? 10));
    if (query.category) {
      params = params.set('category', query.category);
    }
    if (query.search) {
      params = params.set('search', query.search);
    }
    return firstValueFrom(
      this.http.get<HelpResult>(`${this.baseUrl}/articles`, { params }),
    );
  }

  async fetchCategories(): Promise<string[]> {
    return firstValueFrom(
      this.http.get<string[]>(`${this.baseUrl}/categories`),
    );
  }
}
