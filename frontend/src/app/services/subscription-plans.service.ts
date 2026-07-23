import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price_ukp: number;
  price_usd: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  is_popular?: boolean;
  stripe_price_id?: string;
  highlighted_benefits?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class SubscriptionPlansService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/subscription-plans`;

  getAllPlans(): Observable<SubscriptionPlan[]> {
    return this.http.get<SubscriptionPlan[]>(this.apiUrl);
  }

  getPlanById(id: string): Observable<SubscriptionPlan> {
    return this.http.get<SubscriptionPlan>(`${this.apiUrl}/${id}`);
  }

  getHighlightedBenefits(planId: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/${planId}/benefits`);
  }
}
