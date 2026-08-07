import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Registry,
  Counter,
  Histogram,
  Gauge,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly register: Registry;
  private httpRequestDuration: Histogram<string>;
  private httpRequestsTotal: Counter<string>;
  private activeConnections: Gauge<string>;

  // SRS (Spaced Repetition System) metrics
  readonly srsFlashcardsCreated: Counter<string>;
  readonly srsReviewsCompleted: Counter<string>;
  readonly srsDueCards: Gauge<string>;
  readonly srsAverageEasinessFactor: Gauge<string>;
  readonly srsReviewSuccessRate: Gauge<string>;
  readonly srsCardsPerLevel: Gauge<string>;
  readonly srsReviewDuration: Histogram<string>;
  readonly srsCardsStuck: Gauge<string>;
  readonly srsDecksTotal: Gauge<string>;
  readonly srsDecksCreated: Counter<string>;

  // Virtual Coin Economy metrics
  readonly economyCoinPurchases: Counter<string>;
  readonly economyCoinRevenue: Counter<string>;
  readonly economyPurchaseErrors: Counter<string>;
  readonly economyGiftSends: Counter<string>;
  readonly economyGiftRevenue: Counter<string>;
  readonly economyDailyCheckIns: Counter<string>;
  readonly economyDailyCheckInRewards: Counter<string>;
  readonly economyStickerPackUnlocks: Counter<string>;
  readonly economyStickerPackRevenue: Counter<string>;
  readonly economyBalanceQueries: Counter<string>;
  readonly economyCheckoutSessions: Counter<string>;
  readonly economyPurchaseDuration: Histogram<string>;
  readonly economyGiftDuration: Histogram<string>;
  readonly economyUserBalance: Gauge<string>;
  readonly economyActivePurchases: Gauge<string>;

  constructor() {
    this.register = new Registry();

    collectDefaultMetrics({
      register: this.register,
      prefix: 'hellotalk_',
    });

    this.httpRequestDuration = new Histogram({
      name: 'hellotalk_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
    });

    this.httpRequestsTotal = new Counter({
      name: 'hellotalk_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });

    this.activeConnections = new Gauge({
      name: 'hellotalk_active_connections',
      help: 'Number of active connections',
      registers: [this.register],
    });

    // --- SRS Metrics ---

    this.srsFlashcardsCreated = new Counter({
      name: 'hellotalk_srs_flashcards_created_total',
      help: 'Total number of flashcards created or updated',
      labelNames: ['source_language', 'target_language'],
      registers: [this.register],
    });

    this.srsReviewsCompleted = new Counter({
      name: 'hellotalk_srs_reviews_completed_total',
      help: 'Total number of SRS review events completed',
      labelNames: ['quality', 'result'],
      registers: [this.register],
    });

    this.srsDueCards = new Gauge({
      name: 'hellotalk_srs_due_cards',
      help: 'Number of cards currently due for review',
      registers: [this.register],
    });

    this.srsAverageEasinessFactor = new Gauge({
      name: 'hellotalk_srs_average_easiness_factor',
      help: 'Rolling average of SM-2 easiness factor across all cards',
      registers: [this.register],
    });

    this.srsReviewSuccessRate = new Gauge({
      name: 'hellotalk_srs_review_success_rate',
      help: 'Rolling success rate (quality >= 3) of last 100 reviews, 0-1',
      registers: [this.register],
    });

    this.srsCardsPerLevel = new Gauge({
      name: 'hellotalk_srs_cards_per_level',
      help: 'Number of cards at each SRS level',
      labelNames: ['srs_level'],
      registers: [this.register],
    });

    this.srsReviewDuration = new Histogram({
      name: 'hellotalk_srs_review_duration_seconds',
      help: 'Time taken to complete a single SRS review',
      labelNames: ['result'],
      registers: [this.register],
      buckets: [0.5, 1, 2, 5, 10, 15, 30, 60],
    });

    this.srsCardsStuck = new Gauge({
      name: 'hellotalk_srs_cards_stuck',
      help: 'Number of cards stuck at srs_level 0 after 5+ reviews (failed recall repeatedly)',
      registers: [this.register],
    });

    this.srsDecksTotal = new Gauge({
      name: 'hellotalk_srs_decks_total',
      help: 'Total number of flashcard decks',
      registers: [this.register],
    });

    this.srsDecksCreated = new Counter({
      name: 'hellotalk_srs_decks_created_total',
      help: 'Total number of decks created',
      registers: [this.register],
    });

    // --- Virtual Coin Economy Metrics ---

    this.economyCoinPurchases = new Counter({
      name: 'hellotalk_economy_coin_purchases_total',
      help: 'Total number of coin purchase transactions completed',
      labelNames: ['platform', 'package_id', 'status'],
      registers: [this.register],
    });

    this.economyCoinRevenue = new Counter({
      name: 'hellotalk_economy_coin_revenue_total',
      help: 'Total revenue from coin purchases in minor currency units (cents)',
      labelNames: ['platform', 'currency'],
      registers: [this.register],
    });

    this.economyPurchaseErrors = new Counter({
      name: 'hellotalk_economy_purchase_errors_total',
      help: 'Total number of coin purchase errors',
      labelNames: ['platform', 'error_type'],
      registers: [this.register],
    });

    this.economyGiftSends = new Counter({
      name: 'hellotalk_economy_gift_sends_total',
      help: 'Total number of virtual gifts sent',
      labelNames: ['gift_id', 'gift_name'],
      registers: [this.register],
    });

    this.economyGiftRevenue = new Counter({
      name: 'hellotalk_economy_gift_revenue_coins_total',
      help: 'Total coins spent on virtual gifts',
      labelNames: ['gift_id'],
      registers: [this.register],
    });

    this.economyDailyCheckIns = new Counter({
      name: 'hellotalk_economy_daily_check_ins_total',
      help: 'Total number of daily check-in claims',
      labelNames: ['status'],
      registers: [this.register],
    });

    this.economyDailyCheckInRewards = new Counter({
      name: 'hellotalk_economy_daily_check_in_rewards_total',
      help: 'Total coins rewarded from daily check-ins',
      registers: [this.register],
    });

    this.economyStickerPackUnlocks = new Counter({
      name: 'hellotalk_economy_sticker_pack_unlocks_total',
      help: 'Total number of sticker packs unlocked',
      labelNames: ['pack_id'],
      registers: [this.register],
    });

    this.economyStickerPackRevenue = new Counter({
      name: 'hellotalk_economy_sticker_pack_revenue_coins_total',
      help: 'Total coins spent on sticker pack unlocks',
      labelNames: ['pack_id'],
      registers: [this.register],
    });

    this.economyBalanceQueries = new Counter({
      name: 'hellotalk_economy_balance_queries_total',
      help: 'Total number of coin balance queries',
      registers: [this.register],
    });

    this.economyCheckoutSessions = new Counter({
      name: 'hellotalk_economy_checkout_sessions_total',
      help: 'Total number of Stripe checkout sessions created',
      labelNames: ['package_id'],
      registers: [this.register],
    });

    this.economyPurchaseDuration = new Histogram({
      name: 'hellotalk_economy_purchase_duration_seconds',
      help: 'Duration of coin purchase operations from receipt to balance credit',
      labelNames: ['platform'],
      registers: [this.register],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    });

    this.economyGiftDuration = new Histogram({
      name: 'hellotalk_economy_gift_duration_seconds',
      help: 'Duration of gift-send operations',
      registers: [this.register],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    });

    this.economyUserBalance = new Gauge({
      name: 'hellotalk_economy_balance_sample_coins',
      help: 'Sampled user coin balance from the most recent balance query',
      registers: [this.register],
    });

    this.economyActivePurchases = new Gauge({
      name: 'hellotalk_economy_active_purchases',
      help: 'Number of coin purchase operations currently in flight',
      registers: [this.register],
    });
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const labels = { method, route, status_code: String(statusCode) };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, durationSeconds);
  }

  incrementActiveConnections(): void {
    this.activeConnections.inc();
  }

  decrementActiveConnections(): void {
    this.activeConnections.dec();
  }

  // --- SRS metric helpers ---

  recordSrsFlashcardCreated(
    sourceLanguage: string = 'unknown',
    targetLanguage: string = 'unknown',
  ): void {
    this.srsFlashcardsCreated.inc({ source_language: sourceLanguage, target_language: targetLanguage });
  }

  recordSrsReviewCompleted(
    quality: number,
    result: 'pass' | 'fail',
    durationSeconds: number = 0,
  ): void {
    this.srsReviewsCompleted.inc({ quality: String(quality), result });
    this.srsReviewDuration.observe({ result }, durationSeconds);
  }

  setSrsDueCards(count: number): void {
    this.srsDueCards.set(count);
  }

  setSrsAverageEasinessFactor(ef: number): void {
    this.srsAverageEasinessFactor.set(ef);
  }

  setSrsReviewSuccessRate(rate: number): void {
    this.srsReviewSuccessRate.set(rate);
  }

  setSrsCardsPerLevel(level: number, count: number): void {
    this.srsCardsPerLevel.set({ srs_level: String(level) }, count);
  }

  setSrsCardsStuck(count: number): void {
    this.srsCardsStuck.set(count);
  }

  setSrsDecksTotal(count: number): void {
    this.srsDecksTotal.set(count);
  }

  recordSrsDeckCreated(): void {
    this.srsDecksCreated.inc();
  }

  // --- Virtual Coin Economy metric helpers ---

  recordEconomyCoinPurchase(
    platform: string,
    packageId: string,
    status: 'completed' | 'failed' = 'completed',
  ): void {
    this.economyCoinPurchases.inc({ platform, package_id: packageId, status });
  }

  recordEconomyCoinRevenue(
    platform: string,
    currency: string,
    amountMinorUnits: number,
  ): void {
    this.economyCoinRevenue.inc({ platform, currency }, amountMinorUnits);
  }

  recordEconomyPurchaseError(platform: string, errorType: string): void {
    this.economyPurchaseErrors.inc({ platform, error_type: errorType });
  }

  recordEconomyGiftSend(giftId: string, giftName: string): void {
    this.economyGiftSends.inc({ gift_id: giftId, gift_name: giftName });
  }

  recordEconomyGiftRevenue(giftId: string, coinsSpent: number): void {
    this.economyGiftRevenue.inc({ gift_id: giftId }, coinsSpent);
  }

  recordEconomyDailyCheckIn(status: 'claimed' | 'already_claimed'): void {
    this.economyDailyCheckIns.inc({ status });
  }

  recordEconomyDailyCheckInReward(coinsRewarded: number): void {
    this.economyDailyCheckInRewards.inc(coinsRewarded);
  }

  recordEconomyStickerPackUnlock(packId: string): void {
    this.economyStickerPackUnlocks.inc({ pack_id: packId });
  }

  recordEconomyStickerPackRevenue(packId: string, coinsSpent: number): void {
    this.economyStickerPackRevenue.inc({ pack_id: packId }, coinsSpent);
  }

  recordEconomyBalanceQuery(): void {
    this.economyBalanceQueries.inc();
  }

  recordEconomyCheckoutSession(packageId: string): void {
    this.economyCheckoutSessions.inc({ package_id: packageId });
  }

  recordEconomyPurchaseDuration(
    platform: string,
    durationSeconds: number,
  ): void {
    this.economyPurchaseDuration.observe({ platform }, durationSeconds);
  }

  recordEconomyGiftDuration(durationSeconds: number): void {
    this.economyGiftDuration.observe(durationSeconds);
  }

  setEconomyUserBalance(balance: number): void {
    this.economyUserBalance.set(balance);
  }

  incrementEconomyActivePurchases(): void {
    this.economyActivePurchases.inc();
  }

  decrementEconomyActivePurchases(): void {
    this.economyActivePurchases.dec();
  }

  getRegister(): Registry {
    return this.register;
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }
}
