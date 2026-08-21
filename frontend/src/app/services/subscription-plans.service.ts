import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
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
  stripe_price_id_yearly?: string;
  highlighted_benefits?: string[];
  badge_text?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SubscriptionPlansService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/subscription-plans`;

  getAllPlans(): Promise<SubscriptionPlan[]> {
    return firstValueFrom(this.http.get<SubscriptionPlan[]>(this.apiUrl));
  }

  getPlanById(id: string): Promise<SubscriptionPlan> {
    return firstValueFrom(this.http.get<SubscriptionPlan>(`${this.apiUrl}/${id}`));
  }

  getHighlightedBenefits(planId: string): Promise<string[]> {
    return firstValueFrom(this.http.get<string[]>(`${this.apiUrl}/${planId}/benefits`));
  }

  getShowcasePlans(): Promise<SubscriptionPlan[]> {
    return firstValueFrom(this.http.get<SubscriptionPlan[]>(`${this.apiUrl}/showcase`));
  }
}
