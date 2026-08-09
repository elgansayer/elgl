import { showToast } from './toast.service';
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { CentrifugeService } from './centrifuge.service';
import { I18nService } from './i18n.service';
import { SafetyService } from './safety.service';
import { GiftAnimationService, GiftAnimationType } from './gift-animation.service';
import { OfflineEconomyService } from './offline-economy.service';
import { NetworkStatusService } from './network-status.service';

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

export interface StickerPack {
  id: string;
  name: string;
  cost_coins: number;
  owned?: boolean;
  is_animated?: boolean;
  sticker_urls?: string[];
  animation_url?: string;
}

export interface TransactionRecord {
  id: string;
  type: 'earn' | 'spend' | 'gift_sent' | 'gift_received' | 'purchase' | 'daily_checkin';
  amount: number;
  description: string;
  related_user_name?: string;
  related_user_avatar?: string;
  gift_icon?: string;
  created_at: string;
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
  private safetyService = inject(SafetyService);
  private giftAnimationService = inject(GiftAnimationService);
  private offlineEconomy = inject(OfflineEconomyService);
  private networkStatus = inject(NetworkStatusService);
  private baseUrl = `${environment.apiUrl}/economy`;
  private monetisationUrl = `${environment.apiUrl}/monetisation`;
  private safetyUrl = `${environment.apiUrl}/safety`;

  readonly coinsBalance = signal<number>(50);
  readonly stickerPacks = signal<StickerPack[]>([]);
  readonly catalog = signal<VirtualGift[]>([]);
  readonly coinPackages = signal<CoinPackage[]>([]);
  readonly developerStats = signal<DeveloperAnalytics | null>(null);
  readonly activeGiftAnimation = signal<ActiveGiftOverlay | null>(null);
  readonly blockedUserIds = signal<Set<string>>(new Set());
  readonly diagnosticLogs = signal<DiagnosticLog[]>([]);
  readonly recentTransactions = signal<TransactionRecord[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly hasLoadedOnce = signal<boolean>(false);
  readonly isOnline = this.networkStatus.isOnline;

  /** Whether the coin economy is operating in degraded mode (some features limited). */
  readonly isDegraded = signal<boolean>(false);
  /** List of currently degraded feature identifiers reported by the backend. */
  readonly degradedFeatures = signal<string[]>([]);

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`,
    };
  }

  async loadInitialData(): Promise<void> {
    this.isLoading.set(true);
    try {
      if (!this.authService.currentUser() || !this.authService.getAccessToken()) {
        this.isLoading.set(false);
        this.hasLoadedOnce.set(true);
        if (!this.isOnline()) {
          await this.hydrateFromOfflineCache();
        }
        return;
      }

      // Load each independently so one failure does not block the others
      const loadCatalog = firstValueFrom(
        this.http.get<VirtualGift[]>(`${this.baseUrl}/catalog`, { headers: this.getHeaders() }),
      ).then((cat) => {
        this.catalog.set(cat);
        this.offlineEconomy.cacheCatalog(cat);
      }).catch((e) => {
        console.error('Error loading catalog:', e);
      });

      const loadBalance = firstValueFrom(
        this.http.get<{ coins_balance: number }>(`${this.baseUrl}/balance`, {
          headers: this.getHeaders(),
        }),
      ).then((bal) => {
        this.coinsBalance.set(bal.coins_balance);
        this.offlineEconomy.cacheBalance(bal.coins_balance);
      }).catch((e) => {
        console.error('Error loading balance:', e);
      });

      const loadBlocked = firstValueFrom(
        this.http.get<string[]>(`${this.safetyUrl}/blocked-ids`, { headers: this.getHeaders() }),
      ).then((blocked) => this.blockedUserIds.set(new Set(blocked))).catch((e) => {
        console.error('Error loading blocked users:', e);
      });

      const loadTransactions = this.loadTransactionHistory().catch((e) => {
        console.error('Error loading transactions:', e);
      });

      const loadPacks = this.loadStickerPacks().catch((e) => {
        console.error('Error loading sticker packs:', e);
      });

      await Promise.allSettled([loadCatalog, loadBalance, loadBlocked, loadTransactions, loadPacks]);
    } catch (e) {
      console.error('Error loading economy/safety data:', e);
      await this.hydrateFromOfflineCache();
    } finally {
      this.isLoading.set(false);
      this.hasLoadedOnce.set(true);
    }
  }

  private async hydrateFromOfflineCache(): Promise<void> {
    try {
      const [cachedState, cachedCatalog] = await Promise.all([
        this.offlineEconomy.getCachedBalance(),
        this.offlineEconomy.getCachedCatalog(),
      ]);
      if (cachedState) {
        this.coinsBalance.set(cachedState.coinsBalance);
      }
      if (cachedCatalog && cachedCatalog.length > 0) {
        this.catalog.set(cachedCatalog);
      }
    } catch {
      // Offline cache hydration is best-effort
    }
  }


  private getDefaultCatalog(): VirtualGift[] {
    return [
      { id: 'gift_rose', name: 'Rose', icon: '🌹', cost_coins: 10, animation_type: 'float' },
      { id: 'gift_heart', name: 'Heart', icon: '❤️', cost_coins: 20, animation_type: 'hearts' },
      { id: 'gift_confetti', name: 'Confetti Burst', icon: '🎉', cost_coins: 30, animation_type: 'confetti' },
      { id: 'gift_sparkle', name: 'Sparkle', icon: '✨', cost_coins: 50, animation_type: 'sparkle' },
      { id: 'gift_crown', name: 'Crown', icon: '👑', cost_coins: 100, animation_type: 'premium' },
      { id: 'gift_diamond', name: 'Diamond', icon: '💎', cost_coins: 200, animation_type: 'premium' },
    ];
  }

  private getDefaultCoinPackages(): CoinPackage[] {
    return [
      { id: 'coins_small', name: 'Small Coin Pack', coins: 100, price_ukp: 4, price_usd: 4.99 },
      { id: 'coins_medium', name: 'Medium Coin Pack', coins: 500, price_ukp: 16, price_usd: 19.99 },
      { id: 'coins_large', name: 'Large Coin Pack', coins: 1200, price_ukp: 32, price_usd: 39.99 },
      { id: 'coins_mega', name: 'Mega Coin Pack', coins: 3000, price_ukp: 64, price_usd: 79.99 },
    ];
  }

  async claimDailyCheckIn(): Promise<{
    claimed: boolean;
    coins_rewarded: number;
    new_balance: number;
  } | null> {
    if (!this.isOnline()) return null;
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
        this.offlineEconomy.cacheBalance(res.new_balance);
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
      this.offlineEconomy.cacheCoinPackages(packages);
    } catch (e) {
      console.error('Load coin packages error:', e);
      if (!this.isOnline()) {
        const cached = await this.offlineEconomy.getCachedCoinPackages();
        if (cached && cached.length > 0) {
          this.coinPackages.set(cached);
        }
      }
    }
  }

  /**
   * Checks the economy health endpoint and updates degradation state.
   * Called periodically or on-demand to detect when backend dependencies
   * (Redis, Supabase, Stripe, Centrifugo) are degraded/unavailable.
   */
  async checkEconomyHealth(): Promise<void> {
    try {
      const health = await firstValueFrom(
        this.http.get<{
          overall: 'healthy' | 'degraded' | 'unavailable';
          degradedFeatures: string[];
        }>(`${this.baseUrl}/health`),
      );
      this.isDegraded.set(health.overall !== 'healthy');
      this.degradedFeatures.set(health.degradedFeatures ?? []);
    } catch {
      // If the health endpoint itself is unreachable, we are in degraded mode
      this.isDegraded.set(true);
      this.degradedFeatures.set(['health-endpoint-unreachable']);
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
    if (!this.isOnline()) {
      showToast(this.i18n.translate('economy.offlinePurchaseUnavailable'));
      return;
    }
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
      this.offlineEconomy.cacheBalance(res.newBalance);
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
    if (!this.isOnline()) {
      await this.offlineEconomy.enqueuePendingAction('send_gift', {
        receiver_id: receiverId,
        gift_id: giftId,
        room_id: roomId,
      });
      showToast(this.i18n.translate('economy.offlineGiftQueued'));
      return true;
    }
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; coins_remaining: number; gift: VirtualGift }>(
          `${this.baseUrl}/send-gift`,
          { receiver_id: receiverId, gift_id: giftId, room_id: roomId },
          { headers: this.getHeaders() },
        ),
      );
      this.coinsBalance.set(res.coins_remaining);
      this.offlineEconomy.cacheBalance(res.coins_remaining);
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
    if (!this.isOnline()) {
      showToast(this.i18n.translate('economy.offlinePurchaseUnavailable'));
      return;
    }
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
      // Cap message size to prevent unbounded memory from long diagnostic strings.
      const safePayload = {
        ...payload,
        message: payload.message.slice(0, 500),
      };
      const created = await firstValueFrom(
        this.http.post<DiagnosticLogApiRecord>(
          `${this.monetisationUrl}/diagnostics/logs`,
          safePayload,
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
      await this.safetyService.reportUser({
        reported_id: reportedId,
        reason_category: reason,
        description: details,
      });
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
      await this.safetyService.blockUserAsync(blockedId);
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
    const animationType = this.sanitiseAnimationType(overlay.gift.animation_type);
    this.giftAnimationService.playAnimation({
      id: overlay.gift.id,
      giftName: overlay.gift.name,
      giftIcon: overlay.gift.icon,
      animationType,
      animationUrl: overlay.gift.animationUrl,
      senderName: overlay.sender_name,
      receiverName: overlay.receiver_name,
      coinValue: overlay.gift.cost_coins,
    });
  }

  private readonly validAnimationTypes = new Set<string>([
    'float',
    'confetti',
    'premium',
    'sparkle',
    'hearts',
  ]);
  private sanitiseAnimationType(raw: string): GiftAnimationType {
    if (this.isAnimationType(raw)) return raw;
    return 'float';
  }
  private isAnimationType(value: string): value is GiftAnimationType {
    return this.validAnimationTypes.has(value);
  }

  triggerPublicGiftAnimation(payload: {
    giftId: string;
    giftName: string;
    giftIcon: string;
    animationType: string;
    animationUrl?: string;
    senderName: string;
    receiverName: string;
    coinValue: number;
  }): void {
    const animationType = this.sanitiseAnimationType(payload.animationType);
    this.giftAnimationService.playAnimation({
      id: payload.giftId,
      giftName: payload.giftName,
      giftIcon: payload.giftIcon,
      animationType,
      animationUrl: payload.animationUrl,
      senderName: payload.senderName,
      receiverName: payload.receiverName,
      coinValue: payload.coinValue,
    });
  }

  async loadTransactionHistory(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ transactions: TransactionRecord[] }>(`${this.baseUrl}/transactions`, {
          headers: this.getHeaders(),
        }),
      );
      this.recentTransactions.set(res.transactions ?? []);
    } catch (e) {
      console.error('Load transaction history error:', e);
    }
  }

  async loadStickerPacks(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<{
          packs: StickerPack[];
          owned_pack_ids: string[];
          user_coins: number;
        }>(`${this.baseUrl}/sticker-packs`, { headers: this.getHeaders() }),
      );
      this.coinsBalance.set(res.user_coins);
      const ownedSet = new Set(res.owned_pack_ids);
      const processed = res.packs.map((pack) => ({
        ...pack,
        owned: ownedSet.has(pack.id),
      }));
      this.stickerPacks.set(processed);
      this.offlineEconomy.cacheStickerPacks(processed);
      this.offlineEconomy.cacheBalance(res.user_coins);
    } catch (e) {
      console.error('Load sticker packs error:', e);
      if (!this.isOnline()) {
        const cached = await this.offlineEconomy.getCachedStickerPacks();
        if (cached && cached.length > 0) {
          this.stickerPacks.set(cached);
        }
      }
    }
  }

  async unlockStickerPack(packId: string): Promise<boolean> {
    if (!this.isOnline()) {
      await this.offlineEconomy.enqueuePendingAction('unlock_sticker', {
        pack_id: packId,
      });
      showToast(this.i18n.translate('economy.offlineGiftQueued'));
      return false;
    }
    try {
      const res = await firstValueFrom(
        this.http.post<{
          success: boolean;
          coins_remaining: number;
          pack: StickerPack;
        }>(
          `${this.baseUrl}/unlock-sticker-pack`,
          { pack_id: packId },
          { headers: this.getHeaders() },
        ),
      );
      if (res.success) {
        this.coinsBalance.set(res.coins_remaining);
        this.offlineEconomy.cacheBalance(res.coins_remaining);
        this.stickerPacks.update((packs) =>
          packs.map((p) => (p.id === packId ? { ...p, owned: true } : p)),
        );
        showToast(
          this.i18n.translate('sticker.purchaseSuccess', {
            name: res.pack.name,
          }),
        );
        return true;
      }
      return false;
    } catch (e) {
      console.error('Unlock sticker pack error:', e);
      showToast(this.i18n.translate('sticker.notEnoughCoins'));
      return false;
    }
  }

  readonly unlockedStickerUrls = computed(() => {
    return this.stickerPacks()
      .filter((pack) => pack.owned && pack.sticker_urls && pack.sticker_urls.length > 0)
      .flatMap((pack) =>
        (pack.sticker_urls ?? []).map((url) => ({
          id: `${pack.id}_${url.split('/').pop() ?? url}`,
          url,
          pack_name: pack.name,
          is_animated: pack.is_animated ?? (url.endsWith('.webm') || url.endsWith('.json')),
        })),
      );
  });

  readonly unlockedStickerPacks = computed(() => {
    return this.stickerPacks().filter((pack) => pack.owned);
  });

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
