import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

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
  ): Promise<CreateCheckoutSessionResponse> {
    return firstValueFrom(
      this.http.post<CreateCheckoutSessionResponse>(`${this.baseUrl}/create-checkout-session`, {
        planId,
        interval,
      }),
    );
  }

  generateApiKey(): Promise<GenerateApiKeyResponse> {
    return firstValueFrom(
      this.http.post<GenerateApiKeyResponse>(`${this.baseUrl}/generate-api-key`, {}),
    );
  }

  getAnalytics(): Promise<DeveloperAnalyticsResponse> {
    return firstValueFrom(this.http.get<DeveloperAnalyticsResponse>(`${this.baseUrl}/analytics`));
  }

  getDiagnosticLogs(): Promise<DiagnosticLog[]> {
    return firstValueFrom(this.http.get<DiagnosticLog[]>(`${this.baseUrl}/diagnostics/logs`));
  }

  createDiagnosticLog(
    category: 'POSTGIS' | 'CENTRIFUGO' | 'REDIS' | 'LIVEKIT',
    status: 'info' | 'success' | 'warn',
    message: string,
  ): Promise<DiagnosticLog> {
    return firstValueFrom(
      this.http.post<DiagnosticLog>(`${this.baseUrl}/diagnostics/logs`, {
        category,
        status,
        message,
      }),
    );
  }

  validateAppleReceipt(
    receiptData: string,
    excludeOldTransactions?: boolean,
  ): Promise<AppleReceiptValidationResponse> {
    return firstValueFrom(
      this.http.post<AppleReceiptValidationResponse>(`${this.baseUrl}/validate-apple-receipt`, {
        receipt_data: receiptData,
        exclude_old_transactions: excludeOldTransactions,
      }),
    );
  }

  /**
   * Restore previous purchases (Apple App Store / Google Play / Stripe).
   * Calls the backend endpoint that validates receipts and restores VIP status.
   */
  restorePurchases(
    platform: 'ios' | 'android' | 'stripe' = 'stripe',
    receiptData?: string,
  ): Promise<{ received: boolean; status: string }> {
    return firstValueFrom(
      this.http.post<{ received: boolean; status: string }>(
        `${this.baseUrl}/restore-purchases`,
        { platform, receipt_data: receiptData },
      ),
    );
  }

  getCoinsBalance(): Promise<{ coins_balance: number }> {
    return firstValueFrom(
      this.http.get<{ coins_balance: number }>(`${this.baseUrl}/coins-balance`),
    );
  }
}
