import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CreateCheckoutSessionResponse {
  url: string;
  sessionId: string;
}

@Injectable({
  providedIn: 'root',
})
export class StripeService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/stripe`;

  createCheckoutSession(planId: string, interval: 'month' | 'year'): Observable<CreateCheckoutSessionResponse> {
    return this.http.post<CreateCheckoutSessionResponse>(
      `${this.apiUrl}/create-checkout-session`,
      { planId, interval },
    );
  }
}
