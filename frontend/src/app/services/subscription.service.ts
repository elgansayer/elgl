import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export interface SubscriptionDetails {
  isVip: boolean;
  vipTier: string | null;
  email?: string;
}

export interface CancelSubscriptionResponse {
  message: string;
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/monetisation`;

  getSubscriptionDetails(): Observable<SubscriptionDetails> {
    return this.http.get<SubscriptionDetails>(`${this.baseUrl}/subscription`);
  }

  cancelSubscription(): Observable<CancelSubscriptionResponse> {
    return this.http.post<CancelSubscriptionResponse>(
      `${this.baseUrl}/subscription/cancel`,
      {},
    );
  }
}
