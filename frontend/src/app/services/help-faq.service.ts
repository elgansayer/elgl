import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

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
    return firstValueFrom(
      this.http.get<FAQResponse>(`${environment.apiUrl}/help/articles?${params}`),
    );
  }

  getCategories(): Promise<string[]> {
    return firstValueFrom(this.http.get<string[]>(`${environment.apiUrl}/help/categories`));
  }

  getQuickReplies(): Promise<string[]> {
    return firstValueFrom(this.http.get<string[]>(`${environment.apiUrl}/help/quick-replies`));
  }
}
