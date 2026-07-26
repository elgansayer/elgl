import { showToast } from './toast.service';
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { CentrifugeService } from './centrifuge.service';

export interface VirtualGift {
  id: string;
  name: string;
  icon: string;
  cost_coins: number;
  animation_type: string;
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
  providedIn: 'root'
})
export class EconomyStore {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private centrifugeService = inject(CentrifugeService);
  private baseUrl = `${environment.apiUrl}/economy`;
  private monetisationUrl = `${environment.apiUrl}/monetisation`;
  private safetyUrl = `${environment.apiUrl}/safety`;

  readonly coinsBalance = signal<number>(50);
  readonly catalog = signal<VirtualGift[]>([]);
  readonly developerStats = signal<DeveloperAnalytics | null>(null);
  readonly activeGiftAnimation = signal<ActiveGiftOverlay | null>(null);
  readonly blockedUserIds = signal<Set<string>>(new Set());
  readonly diagnosticLogs = signal<DiagnosticLog[]>([]);
  readonly isLoading = signal<boolean>(false);

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`
    };
  }

  async loadInitialData(): Promise<void> {
    this.isLoading.set(true);
    try {
      const [cat, bal, blocked] = await Promise.all([
        firstValueFrom(this.http.get<VirtualGift[]>(`${this.baseUrl}/catalog`, { headers: this.getHeaders() })),
        firstValueFrom(this.http.get<{ coins_balance: number }>(`${this.baseUrl}/balance`, { headers: this.getHeaders() })),
        firstValueFrom(this.http.get<string[]>(`${this.safetyUrl}/blocked-ids`, { headers: this.getHeaders() }))
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

  async purchaseCoins(packageId: string, amount: number): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ coins_balance: number; package_id: string }>(
          `${this.baseUrl}/purchase-coins`,
          { package_id: packageId, amount },
          { headers: this.getHeaders() }
        )
      );
      this.coinsBalance.set(res.coins_balance);
      showToast(`🎉 Successfully purchased ${amount} coins! Your new balance is ${res.coins_balance} coins.`);
    } catch (e) {
      console.error('Coin purchase error:', e);
      showToast('Could not process coin purchase right now.');
    }
  }

  async sendGift(receiverId: string, giftId: string, roomId?: string): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; coins_remaining: number; gift: VirtualGift }>(
          `${this.baseUrl}/send-gift`,
          { receiver_id: receiverId, gift_id: giftId, room_id: roomId },
          { headers: this.getHeaders() }
        )
      );
      this.coinsBalance.set(res.coins_remaining);
      return true;
    } catch (e: unknown) {
      console.error('Send gift error:', e);
      const err = e as { error?: { message?: string } };
      showToast(err?.error?.message || 'Failed to send virtual gift. Ensure you have sufficient coin balance.');
      return false;
    }
  }

  async upgradeVip(tier: 'consumer' | 'developer'): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.monetisationUrl}/upgrade`, { tier }, { headers: this.getHeaders() })
      );
      const user = this.authService.currentUser();
      if (user) {
        this.authService.currentUser.set({ ...user, is_vip: true, vip_tier: tier });
      }
      const title = tier === 'developer' ? 'Developer Tier (20 UKP / $26 USD per month)' : 'Consumer VIP (8 UKP / $10 USD per month)';
      showToast(`🎊 Congratulations! You have successfully upgraded to ${title}. All premium features and unlocked limits are now active!`);
    } catch (e) {
      console.error('VIP upgrade error:', e);
      showToast('Failed to process VIP upgrade.');
    }
  }

  async loadDeveloperAnalytics(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<DeveloperAnalytics>(`${this.monetisationUrl}/analytics`, { headers: this.getHeaders() })
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
            headers: this.getHeaders()
          })
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
          this.http.post<DiagnosticLogApiRecord>(`${this.monetisationUrl}/diagnostics/logs`, payload, {
            headers: this.getHeaders()
          })
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
          { headers: this.getHeaders() }
        )
      );
      await this.loadDeveloperAnalytics();
      showToast(`🔐 Developer API Key generated: ${res.api_key}\nRate Limit: ${res.rate_limit_rpm} RPM`);
      return res.api_key;
    } catch (e: unknown) {
      console.error('Generate API key error:', e);
      const err = e as { error?: { message?: string } };
      showToast(err?.error?.message || 'Failed to generate API key. Requires Developer Tier subscription (20 UKP / $26 USD per month).');
      return null;
    }
  }

  async reportUser(reportedId: string, reason: string, details?: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.safetyUrl}/report`, { reported_id: reportedId, reason, details }, { headers: this.getHeaders() })
      );
      showToast('🛡️ Thank you. Your report has been submitted to our Trust & Safety moderation team for review within 24 hours.');
    } catch (e) {
      console.error('Report user error:', e);
      showToast('Failed to submit report.');
    }
  }

  async blockUser(blockedId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.safetyUrl}/block`, { blocked_id: blockedId }, { headers: this.getHeaders() })
      );
      const set = new Set(this.blockedUserIds());
      set.add(blockedId);
      this.blockedUserIds.set(set);
      showToast('🚫 User blocked. All posts, moments, and direct messages from this user are now hidden across the platform.');
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
      timestamp: new Date(log.created_at).toLocaleTimeString('en-GB')
    };
  }
}
