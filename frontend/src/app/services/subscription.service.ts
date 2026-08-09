import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

export interface SubscriptionBillingDetails {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string;
  nextBillingAmount: number | null;
  currency: string | null;
  interval: string | null;
}

export interface SubscriptionDetails {
  isVip: boolean;
  vipTier: string | null;
  email?: string;
  billing: SubscriptionBillingDetails | null;
}

export interface SubscriptionInvoice {
  id: string;
  amountPaid: number;
  currency: string;
  status: string | null;
  created: string;
  invoicePdf: string | null;
  hostedInvoiceUrl: string | null;
}

export interface CancelSubscriptionResponse {
  message: string;
}

export interface ResumeSubscriptionResponse {
  message: string;
}

export interface BillingPortalSessionResponse {
  url: string;
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/monetisation`;

  getSubscriptionDetails(): Promise<SubscriptionDetails> {
    return firstValueFrom(
      this.http.get<SubscriptionDetails>(`${this.baseUrl}/subscription`),
    );
  }

  cancelSubscription(): Promise<CancelSubscriptionResponse> {
    return firstValueFrom(
      this.http.post<CancelSubscriptionResponse>(
        `${this.baseUrl}/subscription/cancel`,
        {},
      ),
    );
  }

  resumeSubscription(): Promise<ResumeSubscriptionResponse> {
    return firstValueFrom(
      this.http.post<ResumeSubscriptionResponse>(
        `${this.baseUrl}/subscription/resume`,
        {},
      ),
    );
  }

  getInvoices(): Promise<SubscriptionInvoice[]> {
    return firstValueFrom(
      this.http.get<SubscriptionInvoice[]>(`${this.baseUrl}/subscription/invoices`),
    );
  }

  createBillingPortalSession(): Promise<BillingPortalSessionResponse> {
    return firstValueFrom(
      this.http.post<BillingPortalSessionResponse>(
        `${this.baseUrl}/subscription/billing-portal`,
        {},
      ),
    );
  }
}
