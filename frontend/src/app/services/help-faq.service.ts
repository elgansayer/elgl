import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export interface FAQResponse {
  items: FAQItem[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class HelpFaqService {
  private http = inject(HttpClient);

  getFAQs(category?: string): Promise<FAQResponse> {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    return this.http
      .get<FAQResponse>(`${environment.apiUrl}/help/articles?${params}`)
      .toPromise()!;
  }

  getCategories(): Promise<string[]> {
    return this.http
      .get<string[]>(`${environment.apiUrl}/help/categories`)
      .toPromise()!;
  }

  getQuickReplies(): Promise<string[]> {
    return this.http
      .get<string[]>(`${environment.apiUrl}/help/quick-replies`)
      .toPromise()!;
  }
}
