import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export interface HelpResponse {
  items: FaqItem[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class HelpCentreService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/help`;

  getArticles(
    category?: string,
    search?: string,
    page?: number,
    limit?: number,
  ): Observable<HelpResponse> {
    const params: Record<string, string | number> = {};
    if (category) params['category'] = category;
    if (search) params['search'] = search;
    if (page) params['page'] = page;
    if (limit) params['limit'] = limit;
    return this.http.get<HelpResponse>(`${this.baseUrl}/articles`, { params });
  }

  getCategories(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/categories`);
  }
}
