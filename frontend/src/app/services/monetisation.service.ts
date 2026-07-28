import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

export interface CreateCheckoutSessionResponse {
  sessionUrl: string;
  sessionId: string;
}

export interface GenerateApiKeyResponse {
  api_key: string;
  tier: string;
  rate_limit_rpm: number;
}

export interface DeveloperAnalyticsResponse {
  api_key: string | null;
  tier: string;
  total_api_calls_today: number;
  avg_latency_ms: number;
  pricing_info: string;
}

export interface DiagnosticLog {
  id: string;
  user_id: string | null;
  category: 'POSTGIS' | 'CENTRIFUGO' | 'REDIS' | 'LIVEKIT';
  status: 'info' | 'success' | 'warn';
  message: string;
  created_at: string;
}

export interface AppleReceiptValidationResponse {
  valid: boolean;
  product_id?: string;
  expiration_date?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class MonetisationService {
  private readonly baseUrl = '/api/monetisation';
  private readonly http = inject(HttpClient);

  createCheckoutSession(
    planId: string,
    interval: 'month' | 'year',
  ): Observable<CreateCheckoutSessionResponse> {
    return this.http.post<CreateCheckoutSessionResponse>(
      `${this.baseUrl}/create-checkout-session`,
      { planId, interval },
    );
  }

  generateApiKey(): Observable<GenerateApiKeyResponse> {
    return this.http.post<GenerateApiKeyResponse>(`${this.baseUrl}/generate-api-key`, {});
  }

  getAnalytics(): Observable<DeveloperAnalyticsResponse> {
    return this.http.get<DeveloperAnalyticsResponse>(`${this.baseUrl}/analytics`);
  }

  getDiagnosticLogs(): Observable<DiagnosticLog[]> {
    return this.http.get<DiagnosticLog[]>(`${this.baseUrl}/diagnostics/logs`);
  }

  createDiagnosticLog(
    category: 'POSTGIS' | 'CENTRIFUGO' | 'REDIS' | 'LIVEKIT',
    status: 'info' | 'success' | 'warn',
    message: string,
  ): Observable<DiagnosticLog> {
    return this.http.post<DiagnosticLog>(`${this.baseUrl}/diagnostics/logs`, {
      category,
      status,
      message,
    });
  }

  validateAppleReceipt(
    receiptData: string,
    excludeOldTransactions?: boolean,
  ): Observable<AppleReceiptValidationResponse> {
    return this.http.post<AppleReceiptValidationResponse>(
      `${this.baseUrl}/validate-apple-receipt`,
      { receipt_data: receiptData, exclude_old_transactions: excludeOldTransactions },
    );
  }

  /**
   * Restore previous purchases (Apple App Store / Google Play).
   * Calls the backend endpoint that validates receipts and restores VIP status.
   */
  restorePurchases(): Observable<{ received: boolean; status: string }> {
    // The backend expects a POST to /monetisation/restore-purchases
    // with an empty body (or a payload containing platform info).
    // For simplicity, we send an empty object.
    return this.http.post<{ received: boolean; status: string }>(
      `${this.baseUrl}/restore-purchases`,
      {},
    );
  }
}
