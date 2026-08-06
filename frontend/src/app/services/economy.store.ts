import { showToast } from './toast.service';
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { CentrifugeService } from './centrifuge.service';
import { I18nService } from './i18n.service';

export interface VirtualGift {
  id: string;
  name: string;
  icon: string;
  cost_coins: number;
  animation_type: string;
  animationUrl?: string;
}

export interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  price_ukp: number;
  price_usd: number;
}

export interface DeveloperAnalytics {
  api_key: string | null;
  tier: string;
  total_api_calls_today: number;
  avg_latency_ms: number;
  pricing_info: string;
}

export interface ActiveGiftOverlay {
  gift: VirtualGift;
  sender_name: string;
  receiver_name: string;
}

export interface DiagnosticLog {
  id: string;
  timestamp: string;
  category: 'POSTGIS' | 'CENTRIFUGO' | 'REDIS' | 'LIVEKIT';
  message: string;
  status: 'info' | 'success' | 'warn';
}

interface DiagnosticLogApiRecord {
  id: string;
  category: 'POSTGIS' | 'CENTRIFUGO' | 'REDIS' | 'LIVEKIT';
  message: string;
  status: 'info' | 'success' | 'warn';
  created_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class EconomyStore {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private centrifugeService = inject(CentrifugeService);
  private i18n = inject(I18nService);
  private baseUrl = `${environment.apiUrl}/economy`;
  private monetisationUrl = `${environment.apiUrl}/monetisation`;
  private safetyUrl = `${environment.apiUrl}/safety`;

  readonly coinsBalance = signal<number>(50);
  readonly catalog = signal<VirtualGift[]>([]);
  readonly coinPackages = signal<CoinPackage[]>([]);
  readonly developerStats = signal<DeveloperAnalytics | null>(null);
  readonly activeGiftAnimation = signal<ActiveGiftOverlay | null>(null);
  readonly blockedUserIds = signal<Set<string>>(new Set());
  readonly diagnosticLogs = signal<DiagnosticLog[]>([]);
  readonly isLoading = signal<boolean>(false);

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`,
    };
  }

  async loadInitialData(): Promise<void> {
    this.isLoading.set(true);
    try {
      if (!this.authService.currentUser()) {
        return;
      }
      const [cat, bal, blocked] = await Promise.all([
        firstValueFrom(
          this.http.get<VirtualGift[]>(`${this.baseUrl}/catalog`, { headers: this.getHeaders() }),
        ),
        firstValueFrom(
          this.http.get<{ coins_balance: number }>(`${this.baseUrl}/balance`, {
            headers: this.getHeaders(),
          }),
        ),
        firstValueFrom(
          this.http.get<string[]>(`${this.safetyUrl}/blocked-ids`, { headers: this.getHeaders() }),
        ),
      ]);

      this.catalog.set(cat);
      this.coinsBalance.set(bal.coins_balance);
      this.blockedUserIds.set(new Set(blocked));
    } catch (e) {
      console.error('Error loading economy/safety data:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async claimDailyCheckIn(): Promise<{
    claimed: boolean;
    coins_rewarded: number;
    new_balance: number;
  } | null> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ claimed: boolean; coins_rewarded: number; new_balance: number }>(
          `${this.baseUrl}/daily-check-in`,
          {},
          { headers: this.getHeaders() },
        ),
      );
      if (res.claimed) {
        this.coinsBalance.set(res.new_balance);
      }
      return res;
    } catch (e) {
      console.error('Daily check-in error:', e);
      return null;
    }
  }

  async loadCoinPackages(): Promise<void> {
    try {
      const packages = await firstValueFrom(
        this.http.get<CoinPackage[]>(`${this.baseUrl}/packages`, {
          headers: this.getHeaders(),
        }),
      );
      this.coinPackages.set(packages);
    } catch (e) {
      console.error('Load coin packages error:', e);
    }
  }

  /**
   * Starts a real Stripe Checkout session for the chosen coin package and
   * redirects the browser there. Coins are never granted here: the balance
   * only ever moves once the user returns from Stripe and
   * `confirmCoinPurchase` submits the session ID for server-side receipt
   * verification.
   */
  async buyCoins(packageId: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ sessionUrl: string; sessionId: string }>(
          `${this.baseUrl}/create-checkout-session`,
          { package_id: packageId },
          { headers: this.getHeaders() },
        ),
      );
      if (!res.sessionUrl) {
        throw new Error('Checkout session missing redirect URL');
      }
      window.location.href = res.sessionUrl;
    } catch (e) {
      console.error('Coin checkout error:', e);
      showToast(this.i18n.translate('economy.buyCoinsError'));
    }
  }

  async confirmCoinPurchase(sessionId: string): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ coins: number; newBalance: number }>(
          `${this.baseUrl}/purchase-coins`,
          { receipt_token: `stripe_${sessionId}`, platform: 'web' },
          { headers: this.getHeaders() },
        ),
      );
      this.coinsBalance.set(res.newBalance);
      showToast(
        this.i18n.translate('economy.purchaseSuccessToast', {
          coins: res.coins,
          newBalance: res.newBalance,
        }),
      );
      return true;
    } catch (e) {
      console.error('Coin purchase confirmation error:', e);
      showToast(this.i18n.translate('economy.purchaseConfirmError'));
      return false;
    }
  }

  async sendGift(receiverId: string, giftId: string, roomId?: string): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; coins_remaining: number; gift: VirtualGift }>(
          `${this.baseUrl}/send-gift`,
          { receiver_id: receiverId, gift_id: giftId, room_id: roomId },
          { headers: this.getHeaders() },
        ),
      );
      this.coinsBalance.set(res.coins_remaining);
      return true;
    } catch (e: unknown) {
      console.error('Send gift error:', e);
      const message = e instanceof Error ? e.message : String(e);
      showToast(message || 'Failed to send virtual gift. Ensure you have sufficient coin balance.');
      return false;
    }
  }

  /**
   * VIP status can only ever change via a verified payment webhook
   * (Stripe/Apple/Google). This starts a real Stripe Checkout session and
   * redirects the browser there; it must never set `is_vip` client-side.
   */
  async upgradeVip(tier: 'consumer' | 'developer'): Promise<void> {
    const planId = tier === 'developer' ? 'developer_20_ukp_26_usd' : 'consumer_8_ukp_10_usd';
    try {
      const res = await firstValueFrom(
        this.http.post<{ sessionUrl: string; sessionId: string }>(
          `${this.monetisationUrl}/create-checkout-session`,
          { planId, interval: 'month' },
          { headers: this.getHeaders() },
        ),
      );
      if (!res.sessionUrl) {
        throw new Error('Checkout session missing redirect URL');
      }
      window.location.href = res.sessionUrl;
    } catch (e) {
      console.error('VIP upgrade error:', e);
      showToast('Failed to start VIP checkout. Please try again.');
    }
  }

  async loadDeveloperAnalytics(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<DeveloperAnalytics>(`${this.monetisationUrl}/analytics`, {
          headers: this.getHeaders(),
        }),
      );
      this.developerStats.set(res);
    } catch (e) {
      console.error('Load dev analytics error:', e);
    }
  }

  async loadDiagnosticLogs(): Promise<void> {
    try {
      const logs = await firstValueFrom(
        this.http.get<DiagnosticLogApiRecord[]>(`${this.monetisationUrl}/diagnostics/logs`, {
          headers: this.getHeaders(),
        }),
      );
      this.diagnosticLogs.set(logs.map((log) => this.mapDiagnosticLog(log)));
    } catch (e) {
      console.error('Load diagnostic logs error:', e);
      this.diagnosticLogs.set([]);
    }
  }

  async createDiagnosticLog(payload: {
    category: 'POSTGIS' | 'CENTRIFUGO' | 'REDIS' | 'LIVEKIT';
    status: 'info' | 'success' | 'warn';
    message: string;
  }): Promise<void> {
    try {
      const created = await firstValueFrom(
        this.http.post<DiagnosticLogApiRecord>(
          `${this.monetisationUrl}/diagnostics/logs`,
          payload,
          {
            headers: this.getHeaders(),
          },
        ),
      );
      const mapped = this.mapDiagnosticLog(created);
      this.diagnosticLogs.update((current) => [mapped, ...current].slice(0, 20));
    } catch (e) {
      console.error('Create diagnostic log error:', e);
    }
  }

  async generateApiKey(): Promise<string | null> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ api_key: string; tier: string; rate_limit_rpm: number }>(
          `${this.monetisationUrl}/generate-api-key`,
          {},
          { headers: this.getHeaders() },
        ),
      );
      await this.loadDeveloperAnalytics();
      showToast(
        `🔐 Developer API Key generated: ${res.api_key}\nRate Limit: ${res.rate_limit_rpm} RPM`,
      );
      return res.api_key;
    } catch (e: unknown) {
      console.error('Generate API key error:', e);
      const message = e instanceof Error ? e.message : String(e);
      showToast(
        message ||
          'Failed to generate API key. Requires Developer Tier subscription (20 UKP / $26 USD per month).',
      );
      return null;
    }
  }

  async reportUser(reportedId: string, reason: string, details?: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          `${this.safetyUrl}/report`,
          { reported_id: reportedId, reason, details },
          { headers: this.getHeaders() },
        ),
      );
      showToast(
        '🛡️ Thank you. Your report has been submitted to our Trust & Safety moderation team for review within 24 hours.',
      );
    } catch (e) {
      console.error('Report user error:', e);
      showToast('Failed to submit report.');
    }
  }

  async blockUser(blockedId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          `${this.safetyUrl}/block`,
          { blocked_id: blockedId },
          { headers: this.getHeaders() },
        ),
      );
      const set = new Set(this.blockedUserIds());
      set.add(blockedId);
      this.blockedUserIds.set(set);
      showToast(
        '🚫 User blocked. All posts, moments, and direct messages from this user are now hidden across the platform.',
      );
    } catch (e) {
      console.error('Block user error:', e);
      showToast('Failed to block user.');
    }
  }

  triggerGiftAnimation(overlay: ActiveGiftOverlay): void {
    this.activeGiftAnimation.set(overlay);
    setTimeout(() => {
      this.activeGiftAnimation.set(null);
    }, 4500);
  }

  private mapDiagnosticLog(log: DiagnosticLogApiRecord): DiagnosticLog {
    return {
      id: log.id,
      category: log.category,
      message: log.message,
      status: log.status,
      timestamp: new Date(log.created_at).toLocaleTimeString('en-GB'),
    };
  }
}
