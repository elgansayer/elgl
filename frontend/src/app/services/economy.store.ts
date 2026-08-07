import { showToast } from './toast.service';
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { CentrifugeService } from './centrifuge.service';
import { I18nService } from './i18n.service';
import { GiftAnimationService, GiftAnimationType } from './gift-animation.service';
import { OfflineEconomyService } from './offline-economy.service';
import { NetworkStatusService } from './network-status.service';
import { EconomyErrorHandlerService } from './economy-error-handler.service';

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
  private giftAnimationService = inject(GiftAnimationService);
  private offlineEconomy = inject(OfflineEconomyService);
  private networkStatus = inject(NetworkStatusService);
  private economyErrorHandler = inject(EconomyErrorHandlerService);
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
      if (!this.authService.currentUser() || !this.authService.getAccessToken()) {
        return;
      }

      const isOnline = this.networkStatus.isOnline();

      if (isOnline) {
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

        // Cache for offline use
        await this.offlineEconomy.cacheCatalog(cat).catch(() => undefined);
        await this.offlineEconomy.cacheBalance(bal.coins_balance).catch(() => undefined);
      } else {
        // Load from offline cache
        const [cachedCatalog, cachedBalance] = await Promise.all([
          this.offlineEconomy.getCachedCatalog(),
          this.offlineEconomy.getCachedBalance(),
        ]);

        if (cachedCatalog.length > 0) {
          this.catalog.set(cachedCatalog);
        }
        if (cachedBalance !== null) {
          this.coinsBalance.set(cachedBalance.coinsBalance);
        }
      }
    } catch (e) {
      this.economyErrorHandler.reportEconomyCrash(e instanceof Error ? e : new Error(String(e)), { action: 'loadInitialData', coinBalance: this.coinsBalance() });
      // Try offline fallback on error
      try {
        const [cachedCatalog, cachedBalance] = await Promise.all([
          this.offlineEconomy.getCachedCatalog(),
          this.offlineEconomy.getCachedBalance(),
        ]);
        if (cachedCatalog.length > 0) {
          this.catalog.set(cachedCatalog);
        }
        if (cachedBalance !== null) {
          this.coinsBalance.set(cachedBalance.coinsBalance);
        }
      } catch {
        // Silently handle cascade failure
      }
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
      this.economyErrorHandler.reportEconomyCrash(e instanceof Error ? e : new Error(String(e)), { action: 'claimDailyCheckIn', coinBalance: this.coinsBalance() });
      return null;
    }
  }

  async loadCoinPackages(): Promise<void> {
    try {
      const isOnline = this.networkStatus.isOnline();
      if (isOnline) {
        const packages = await firstValueFrom(
          this.http.get<CoinPackage[]>(`${this.baseUrl}/packages`, {
            headers: this.getHeaders(),
          }),
        );
        this.coinPackages.set(packages);
        await this.offlineEconomy.cacheCoinPackages(packages).catch(() => undefined);
      } else {
        const cached = await this.offlineEconomy.getCachedCoinPackages();
        if (cached.length > 0) {
          this.coinPackages.set(cached);
        }
      }
    } catch (e) {
      this.economyErrorHandler.reportEconomyCrash(e instanceof Error ? e : new Error(String(e)), { action: 'loadCoinPackages' });
      // Fallback to cache on error
      try {
        const cached = await this.offlineEconomy.getCachedCoinPackages();
        if (cached.length > 0) {
          this.coinPackages.set(cached);
        }
      } catch {
        // Silently handle
      }
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
      this.economyErrorHandler.reportEconomyCrash(e instanceof Error ? e : new Error(String(e)), { action: 'buyCoins', coinBalance: this.coinsBalance() });
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
      this.economyErrorHandler.reportEconomyCrash(e instanceof Error ? e : new Error(String(e)), { action: 'confirmCoinPurchase', coinBalance: this.coinsBalance() });
      showToast(this.i18n.translate('economy.purchaseConfirmError'));
      return false;
    }
  }

  async sendGift(receiverId: string, giftId: string, roomId?: string): Promise<boolean> {
    // When offline, queue the action for later sync
    if (!this.networkStatus.isOnline()) {
      await this.offlineEconomy.enqueuePendingAction('send_gift', {
        receiver_id: receiverId,
        gift_id: giftId,
        room_id: roomId ?? '',
      });
      // Optimistically deduct the gift cost from cached balance
      const gift = this.catalog().find((g) => g.id === giftId);
      if (gift) {
        this.coinsBalance.update((b) => Math.max(0, b - gift.cost_coins));
        await this.offlineEconomy.cacheBalance(this.coinsBalance()).catch(() => undefined);
      }
      showToast(this.i18n.translate('economy.giftQueuedOffline'));
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
      // Update offline cache with new balance
      await this.offlineEconomy.cacheBalance(res.coins_remaining).catch(() => undefined);
      return true;
    } catch (e: unknown) {
      this.economyErrorHandler.reportEconomyCrash(e instanceof Error ? e : new Error(String(e)), { action: 'sendGift', coinBalance: this.coinsBalance() });
      const message = e instanceof Error ? e.message : String(e);
      showToast(message || this.i18n.translate('economy.sendGiftError'));
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
      this.economyErrorHandler.reportEconomyCrash(e instanceof Error ? e : new Error(String(e)), { action: 'upgradeVip', coinBalance: this.coinsBalance() });
      showToast(this.i18n.translate('economy.vipUpgradeError'));
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
      this.economyErrorHandler.reportEconomyCrash(e instanceof Error ? e : new Error(String(e)), { action: 'loadDeveloperAnalytics' });
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
      this.economyErrorHandler.reportEconomyCrash(e instanceof Error ? e : new Error(String(e)), { action: 'loadDiagnosticLogs' });
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
      this.economyErrorHandler.reportEconomyCrash(e instanceof Error ? e : new Error(String(e)), { action: 'createDiagnosticLog' });
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
      this.economyErrorHandler.reportEconomyCrash(e instanceof Error ? e : new Error(String(e)), { action: 'generateApiKey' });
      const message = e instanceof Error ? e.message : String(e);
      showToast(
        message || this.i18n.translate('economy.apiKeyGenerationError'),
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
      showToast(this.i18n.translate('safety.reportSubmitted'));
    } catch (e) {
      this.economyErrorHandler.reportEconomyCrash(e instanceof Error ? e : new Error(String(e)), { action: 'reportUser' });
      showToast(this.i18n.translate('safety.reportError'));
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
      showToast(this.i18n.translate('safety.userBlocked'));
    } catch (e) {
      this.economyErrorHandler.reportEconomyCrash(e instanceof Error ? e : new Error(String(e)), { action: 'blockUser' });
      showToast(this.i18n.translate('safety.blockError'));
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

  private readonly validAnimationTypes = new Set<string>(['float', 'confetti', 'premium', 'sparkle', 'hearts']);
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

  async loadStickerPacks(): Promise<void> {
    try {
      const isOnline = this.networkStatus.isOnline();
      if (isOnline) {
        const res = await firstValueFrom(
          this.http.get<{
            packs: StickerPack[];
            owned_pack_ids: string[];
            user_coins: number;
          }>(`${this.baseUrl}/sticker-packs`, { headers: this.getHeaders() }),
        );
        this.coinsBalance.set(res.user_coins);
        const ownedSet = new Set(res.owned_pack_ids);
        const packs = res.packs.map((pack) => ({
          ...pack,
          owned: ownedSet.has(pack.id),
        }));
        this.stickerPacks.set(packs);

        // Cache for offline use
        await this.offlineEconomy.cacheStickerPacks(packs).catch(() => undefined);
        await this.offlineEconomy.cacheBalance(res.user_coins).catch(() => undefined);
      } else {
        const cached = await this.offlineEconomy.getCachedStickerPacks();
        if (cached.length > 0) {
          this.stickerPacks.set(cached);
        }
      }
    } catch (e) {
      this.economyErrorHandler.reportEconomyCrash(e instanceof Error ? e : new Error(String(e)), { action: 'loadStickerPacks', coinBalance: this.coinsBalance() });
      // Fallback to cache on error
      try {
        const cached = await this.offlineEconomy.getCachedStickerPacks();
        if (cached.length > 0) {
          this.stickerPacks.set(cached);
        }
      } catch {
        // Silently handle
      }
    }
  }

  async unlockStickerPack(packId: string): Promise<boolean> {
    if (!this.networkStatus.isOnline()) {
      await this.offlineEconomy.enqueuePendingAction('unlock_sticker', { pack_id: packId });
      // Optimistically mark as owned locally
      this.stickerPacks.update((packs) =>
        packs.map((p) => (p.id === packId ? { ...p, owned: true } : p)),
      );
      showToast(this.i18n.translate('sticker.queuedOffline'));
      return true;
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
        this.stickerPacks.update((packs) =>
          packs.map((p) =>
            p.id === packId ? { ...p, owned: true } : p,
          ),
        );
        await this.offlineEconomy.cacheBalance(res.coins_remaining).catch(() => undefined);
        await this.offlineEconomy.cacheStickerPacks(this.stickerPacks()).catch(() => undefined);
        showToast(
          this.i18n.translate('sticker.purchaseSuccess', {
            name: res.pack.name,
          }),
        );
        return true;
      }
      return false;
    } catch (e) {
      this.economyErrorHandler.reportEconomyCrash(e instanceof Error ? e : new Error(String(e)), { action: 'unlockStickerPack', coinBalance: this.coinsBalance() });
      showToast(this.i18n.translate('sticker.notEnoughCoins'));
      return false;
    }
  }

  /**
   * Sync pending offline economy actions when connectivity is restored.
   * Called by the AppComponent or a network status effect.
   */
  async syncPendingActions(): Promise<{ synced: number; failed: number }> {
    const pending = await this.offlineEconomy.getPendingActions();
    if (pending.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;

    for (const action of pending) {
      try {
        switch (action.actionType) {
          case 'send_gift': {
            const payload = action.payload as { receiver_id: string; gift_id: string; room_id?: string };
            await firstValueFrom(
              this.http.post<{ success: boolean; coins_remaining: number; gift: VirtualGift }>(
                `${this.baseUrl}/send-gift`,
                {
                  receiver_id: payload.receiver_id,
                  gift_id: payload.gift_id,
                  room_id: payload.room_id ?? '',
                },
                { headers: this.getHeaders() },
              ),
            );
            break;
          }
          case 'unlock_sticker': {
            const payload = action.payload as { pack_id: string };
            await firstValueFrom(
              this.http.post<{ success: boolean; coins_remaining: number; pack: StickerPack }>(
                `${this.baseUrl}/unlock-sticker-pack`,
                { pack_id: payload.pack_id },
                { headers: this.getHeaders() },
              ),
            );
            break;
          }
          default:
            break;
        }
        await this.offlineEconomy.removePendingAction(action.id);
        synced++;
      } catch {
        failed++;
      }
    }

    // Reload fresh data after sync
    if (synced > 0) {
      await this.loadInitialData();
    }

    return { synced, failed };
  }

  readonly unlockedStickerUrls = computed(() => {
    return this.stickerPacks()
      .filter((pack) => pack.owned && pack.sticker_urls && pack.sticker_urls.length > 0)
      .flatMap((pack) =>
        pack.sticker_urls!.map((url) => ({
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
