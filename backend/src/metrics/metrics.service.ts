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

  // Trust & Safety metrics
  readonly tsReportsSubmitted: Counter<string>;
  readonly tsBlocksCreated: Counter<string>;
  readonly tsBlocksRemoved: Counter<string>;
  readonly tsPendingReports: Gauge<string>;
  readonly tsActiveBlocksTotal: Gauge<string>;
  readonly tsModerationActions: Counter<string>;
  readonly tsDatingRiskScore: Histogram<string>;
  readonly tsReportsByCategory: Counter<string>;
  readonly tsModerationQueueLatency: Histogram<string>;

  // LingQ Reading Engine metrics
  readonly readingEngineSessions: Counter<string>;
  readonly readingEngineWordsParsed: Counter<string>;
  readonly readingEngineTokenisationDuration: Histogram<string>;
  readonly readingEngineAiRequests: Counter<string>;
  readonly readingEngineAiRequestDuration: Histogram<string>;
  readonly readingEngineAiErrors: Counter<string>;
  readonly readingEngineFlashcardSaves: Counter<string>;
  readonly readingEngineSessionDuration: Histogram<string>;
  readonly readingEngineUserWordsLookedUp: Counter<string>;
  readonly readingEngineDailyActiveReaders: Gauge<string>;

  // Escrow Payment metrics
  readonly escrowTransactionsCreated: Counter<string>;
  readonly escrowTransactionsReleased: Counter<string>;
  readonly escrowTransactionsRefunded: Counter<string>;
  readonly escrowTransactionsCancelled: Counter<string>;
  readonly escrowTotalHeld: Gauge<string>;
  readonly escrowTotalCoinsHeld: Gauge<string>;
  readonly escrowAmountPerTransaction: Histogram<string>;
  readonly escrowStaleHeldCount: Gauge<string>;
  readonly escrowAutoRefundCount: Counter<string>;
  readonly escrowDegradedQueueSize: Gauge<string>;

  // Virtual Coin Economy metrics
  readonly coinPurchaseTotal: Counter<string>;
  readonly coinPurchaseValue: Counter<string>;
  readonly coinBalanceTotal: Gauge<string>;
  readonly coinHighBalanceUsers: Gauge<string>;
  readonly coinDailyClaimTotal: Counter<string>;
  readonly coinGiftTotal: Counter<string>;
  readonly coinGiftValue: Counter<string>;
  readonly coinStickerPurchaseTotal: Counter<string>;
  readonly coinStickerRevenueTotal: Counter<string>;
  readonly coinPurchaseErrorsTotal: Counter<string>;
  readonly coinFraudAttemptsTotal: Counter<string>;
  readonly coinTransactionLatency: Histogram<string>;

  // Matchmaking (Recommendations) metrics
  readonly matchmakingRecommendationsGenerated: Counter<string>;
  readonly matchmakingRecommendationsPerRequest: Histogram<string>;
  readonly matchmakingFallbackTierUsed: Counter<string>;
  readonly matchmakingEmptyResultsTotal: Counter<string>;
  readonly matchmakingRequestDuration: Histogram<string>;
  readonly matchmakingDailyCacheMisses: Counter<string>;
  readonly matchmakingTierSuccessRate: Gauge<string>;

  // Admin Moderation Dashboard metrics
  readonly adminBanActions: Counter<string>;
  readonly adminWarnActions: Counter<string>;
  readonly adminVipToggles: Counter<string>;
  readonly adminBlockRemovals: Counter<string>;
  readonly adminReportResolutions: Counter<string>;
  readonly adminApiErrors: Counter<string>;
  readonly adminApiLatency: Histogram<string>;
  readonly adminPendingReports: Gauge<string>;
  readonly adminActiveBlocks: Gauge<string>;
  readonly adminLoginHistoryRequests: Counter<string>;

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

    // --- Trust & Safety Metrics ---

    this.tsReportsSubmitted = new Counter({
      name: 'hellotalk_ts_reports_submitted_total',
      help: 'Total number of user reports submitted',
      labelNames: ['reason_category'],
      registers: [this.register],
    });

    this.tsBlocksCreated = new Counter({
      name: 'hellotalk_ts_blocks_created_total',
      help: 'Total number of user blocks created',
      registers: [this.register],
    });

    this.tsBlocksRemoved = new Counter({
      name: 'hellotalk_ts_blocks_removed_total',
      help: 'Total number of user blocks removed (unblocks)',
      registers: [this.register],
    });

    this.tsPendingReports = new Gauge({
      name: 'hellotalk_ts_pending_reports',
      help: 'Number of reports currently in pending status',
      registers: [this.register],
    });

    this.tsActiveBlocksTotal = new Gauge({
      name: 'hellotalk_ts_active_blocks_total',
      help: 'Total number of active blocks across all users',
      registers: [this.register],
    });

    this.tsModerationActions = new Counter({
      name: 'hellotalk_ts_moderation_actions_total',
      help: 'Total number of moderation actions (approve/reject)',
      labelNames: ['action', 'type'],
      registers: [this.register],
    });

    this.tsDatingRiskScore = new Histogram({
      name: 'hellotalk_ts_dating_risk_score',
      help: 'Distribution of dating behaviour risk scores from user analysis',
      buckets: [0, 10, 25, 50, 75, 90, 100],
      registers: [this.register],
    });

    this.tsReportsByCategory = new Counter({
      name: 'hellotalk_ts_reports_by_category_total',
      help: 'Total number of reports grouped by reason category',
      labelNames: ['category'],
      registers: [this.register],
    });

    this.tsModerationQueueLatency = new Histogram({
      name: 'hellotalk_ts_moderation_queue_latency_seconds',
      help: 'Time taken for moderation actions (approve/reject) to complete',
      labelNames: ['action'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    // --- LingQ Reading Engine Metrics ---

    this.readingEngineSessions = new Counter({
      name: 'hellotalk_reading_engine_sessions_total',
      help: 'Total number of LingQ reading sessions started',
      labelNames: ['language'],
      registers: [this.register],
    });

    this.readingEngineWordsParsed = new Counter({
      name: 'hellotalk_reading_engine_words_parsed_total',
      help: 'Total number of words tokenised via Intl.Segmenter',
      labelNames: ['language'],
      registers: [this.register],
    });

    this.readingEngineTokenisationDuration = new Histogram({
      name: 'hellotalk_reading_engine_tokenisation_duration_seconds',
      help: 'Time taken to tokenise text using Intl.Segmenter',
      labelNames: ['language'],
      registers: [this.register],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    });

    this.readingEngineAiRequests = new Counter({
      name: 'hellotalk_reading_engine_ai_requests_total',
      help: 'Total NLP/AI requests made (translate, grammar, pronunciation, simplify)',
      labelNames: ['endpoint', 'status'],
      registers: [this.register],
    });

    this.readingEngineAiRequestDuration = new Histogram({
      name: 'hellotalk_reading_engine_ai_request_duration_seconds',
      help: 'Duration of NLP/AI API calls (DeepL, Azure)',
      labelNames: ['endpoint'],
      registers: [this.register],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    });

    this.readingEngineAiErrors = new Counter({
      name: 'hellotalk_reading_engine_ai_errors_total',
      help: 'Total NLP/AI request errors (non-200 responses, timeouts)',
      labelNames: ['endpoint', 'error_type'],
      registers: [this.register],
    });

    this.readingEngineFlashcardSaves = new Counter({
      name: 'hellotalk_reading_engine_flashcard_saves_total',
      help: 'Total flashcards saved from LingQ reading sessions',
      labelNames: ['source_language', 'target_language'],
      registers: [this.register],
    });

    this.readingEngineSessionDuration = new Histogram({
      name: 'hellotalk_reading_engine_session_duration_seconds',
      help: 'Duration of LingQ reading sessions',
      labelNames: ['language'],
      registers: [this.register],
      buckets: [10, 60, 180, 600, 1200, 1800, 3600],
    });

    this.readingEngineUserWordsLookedUp = new Counter({
      name: 'hellotalk_reading_engine_words_looked_up_total',
      help: 'Total number of word definitions/traductions looked up',
      labelNames: ['source_language', 'target_language'],
      registers: [this.register],
    });

    this.readingEngineDailyActiveReaders = new Gauge({
      name: 'hellotalk_reading_engine_daily_active_readers',
      help: 'Number of unique users who started a reading session in the last 24h',
      registers: [this.register],
    });

    // --- Escrow Payment Metrics ---

    this.escrowTransactionsCreated = new Counter({
      name: 'hellotalk_escrow_transactions_created_total',
      help: 'Total number of escrow transactions created',
      labelNames: ['status'],
      registers: [this.register],
    });

    this.escrowTransactionsReleased = new Counter({
      name: 'hellotalk_escrow_transactions_released_total',
      help: 'Total number of escrow transactions released to payee',
      registers: [this.register],
    });

    this.escrowTransactionsRefunded = new Counter({
      name: 'hellotalk_escrow_transactions_refunded_total',
      help: 'Total number of escrow transactions refunded to payer',
      labelNames: ['reason'],
      registers: [this.register],
    });

    this.escrowTransactionsCancelled = new Counter({
      name: 'hellotalk_escrow_transactions_cancelled_total',
      help: 'Total number of escrow transactions cancelled',
      registers: [this.register],
    });

    this.escrowTotalHeld = new Gauge({
      name: 'hellotalk_escrow_total_held',
      help: 'Number of escrow transactions currently in held status',
      registers: [this.register],
    });

    this.escrowTotalCoinsHeld = new Gauge({
      name: 'hellotalk_escrow_total_coins_held',
      help: 'Total amount of coins held in escrow',
      registers: [this.register],
    });

    this.escrowAmountPerTransaction = new Histogram({
      name: 'hellotalk_escrow_amount_per_transaction',
      help: 'Distribution of coin amounts per escrow transaction',
      registers: [this.register],
      buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    });

    this.escrowStaleHeldCount = new Gauge({
      name: 'hellotalk_escrow_stale_held_count',
      help: 'Number of escrows held for more than 30 days (stale)',
      registers: [this.register],
    });

    this.escrowAutoRefundCount = new Counter({
      name: 'hellotalk_escrow_auto_refund_total',
      help: 'Total number of escrows auto-refunded by the expiry cleanup job',
      registers: [this.register],
    });

    this.escrowDegradedQueueSize = new Gauge({
      name: 'hellotalk_escrow_degraded_queue_size',
      help: 'Number of escrow operations queued in the degraded (fallback) queue',
      registers: [this.register],
    });

    // --- Virtual Coin Economy Metrics ---

    this.coinPurchaseTotal = new Counter({
      name: 'hellotalk_coin_purchases_total',
      help: 'Total number of coin purchase transactions (all platforms)',
      labelNames: ['platform', 'package_id', 'status'],
      registers: [this.register],
    });

    this.coinPurchaseValue = new Counter({
      name: 'hellotalk_coin_purchase_value_total',
      help: 'Total monetary value of coin purchases in USD cents',
      labelNames: ['platform', 'package_id'],
      registers: [this.register],
    });

    this.coinBalanceTotal = new Gauge({
      name: 'hellotalk_coin_balance_total',
      help: 'Aggregate coin balance across all users (sampled periodically)',
      registers: [this.register],
    });

    this.coinHighBalanceUsers = new Gauge({
      name: 'hellotalk_coin_high_balance_users',
      help: 'Number of users with coin balance exceeding 10000 (potential fraud indicator)',
      registers: [this.register],
    });

    this.coinDailyClaimTotal = new Counter({
      name: 'hellotalk_coin_daily_claims_total',
      help: 'Total number of daily check-in coin claims',
      labelNames: ['claimed'],
      registers: [this.register],
    });

    this.coinGiftTotal = new Counter({
      name: 'hellotalk_coin_gifts_total',
      help: 'Total number of virtual gift transactions',
      labelNames: ['gift_id', 'animation_type'],
      registers: [this.register],
    });

    this.coinGiftValue = new Counter({
      name: 'hellotalk_coin_gift_value_total',
      help: 'Total coin value of all virtual gifts sent',
      labelNames: ['gift_id'],
      registers: [this.register],
    });

    this.coinStickerPurchaseTotal = new Counter({
      name: 'hellotalk_coin_sticker_purchases_total',
      help: 'Total number of sticker pack purchases',
      labelNames: ['pack_id'],
      registers: [this.register],
    });

    this.coinStickerRevenueTotal = new Counter({
      name: 'hellotalk_coin_sticker_revenue_total',
      help: 'Total coin value spent on sticker pack purchases',
      labelNames: ['pack_id'],
      registers: [this.register],
    });

    this.coinPurchaseErrorsTotal = new Counter({
      name: 'hellotalk_coin_purchase_errors_total',
      help: 'Total number of coin purchase errors',
      labelNames: ['error_type', 'platform'],
      registers: [this.register],
    });

    this.coinFraudAttemptsTotal = new Counter({
      name: 'hellotalk_coin_fraud_attempts_total',
      help: 'Total number of suspected fraudulent coin purchase attempts',
      labelNames: ['reason', 'platform'],
      registers: [this.register],
    });

    this.coinTransactionLatency = new Histogram({
      name: 'hellotalk_coin_transaction_latency_seconds',
      help: 'Latency of coin-related transactions',
      labelNames: ['operation'],
      registers: [this.register],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
    });

    // --- Matchmaking (Recommendations) Metrics ---

    this.matchmakingRecommendationsGenerated = new Counter({
      name: 'hellotalk_matchmaking_recommendations_generated_total',
      help: 'Total number of recommendation results served to users',
      labelNames: ['tier', 'endpoint'],
      registers: [this.register],
    });

    this.matchmakingRecommendationsPerRequest = new Histogram({
      name: 'hellotalk_matchmaking_recommendations_per_request',
      help: 'Number of recommendations returned per request',
      labelNames: ['tier'],
      registers: [this.register],
      buckets: [0, 1, 5, 10, 15, 20, 50],
    });

    this.matchmakingFallbackTierUsed = new Counter({
      name: 'hellotalk_matchmaking_fallback_tier_used_total',
      help: 'Number of times a fallback tier was used (tier > 1)',
      labelNames: ['from_tier', 'to_tier'],
      registers: [this.register],
    });

    this.matchmakingEmptyResultsTotal = new Counter({
      name: 'hellotalk_matchmaking_empty_results_total',
      help: 'Number of requests that returned zero recommendations',
      labelNames: ['endpoint'],
      registers: [this.register],
    });

    this.matchmakingRequestDuration = new Histogram({
      name: 'hellotalk_matchmaking_request_duration_seconds',
      help: 'End-to-end duration of matchmaking recommendation requests',
      labelNames: ['endpoint', 'outcome'],
      registers: [this.register],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
    });

    this.matchmakingDailyCacheMisses = new Counter({
      name: 'hellotalk_matchmaking_daily_cache_misses_total',
      help: 'Number of times Redis cache was unavailable or empty for daily recommendations',
      labelNames: ['reason'],
      registers: [this.register],
    });

    this.matchmakingTierSuccessRate = new Gauge({
      name: 'hellotalk_matchmaking_tier_success_rate',
      help: 'Rolling success rate of tier-1 (interest-based) matchmaking, 0-1',
      registers: [this.register],
    });

    // --- Admin Moderation Dashboard Metrics ---

    this.adminBanActions = new Counter({
      name: 'hellotalk_admin_ban_actions_total',
      help: 'Total number of admin ban actions performed',
      labelNames: ['result'],
      registers: [this.register],
    });

    this.adminWarnActions = new Counter({
      name: 'hellotalk_admin_warn_actions_total',
      help: 'Total number of admin warning actions performed',
      labelNames: ['result'],
      registers: [this.register],
    });

    this.adminVipToggles = new Counter({
      name: 'hellotalk_admin_vip_toggles_total',
      help: 'Total number of VIP status toggles by admins',
      labelNames: ['result'],
      registers: [this.register],
    });

    this.adminBlockRemovals = new Counter({
      name: 'hellotalk_admin_block_removals_total',
      help: 'Total number of block removals by admins',
      labelNames: ['result'],
      registers: [this.register],
    });

    this.adminReportResolutions = new Counter({
      name: 'hellotalk_admin_report_resolutions_total',
      help: 'Total number of report resolutions (approve/reject)',
      labelNames: ['action', 'result'],
      registers: [this.register],
    });

    this.adminApiErrors = new Counter({
      name: 'hellotalk_admin_api_errors_total',
      help: 'Total number of admin API errors',
      labelNames: ['endpoint', 'error_type'],
      registers: [this.register],
    });

    this.adminApiLatency = new Histogram({
      name: 'hellotalk_admin_api_latency_seconds',
      help: 'Latency of admin API operations',
      labelNames: ['endpoint', 'action'],
      registers: [this.register],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
    });

    this.adminPendingReports = new Gauge({
      name: 'hellotalk_admin_pending_reports',
      help: 'Number of reports pending admin review',
      registers: [this.register],
    });

    this.adminActiveBlocks = new Gauge({
      name: 'hellotalk_admin_active_blocks',
      help: 'Total number of active block relationships across the platform',
      registers: [this.register],
    });

    this.adminLoginHistoryRequests = new Counter({
      name: 'hellotalk_admin_login_history_requests_total',
      help: 'Total number of admin login history lookup requests',
      labelNames: ['result'],
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
    this.srsFlashcardsCreated.inc({
      source_language: sourceLanguage,
      target_language: targetLanguage,
    });
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

  // --- Trust & Safety metric helpers ---

  recordTsReportSubmitted(reasonCategory: string = 'unknown'): void {
    this.tsReportsSubmitted.inc({ reason_category: reasonCategory });
    this.tsReportsByCategory.inc({ category: reasonCategory });
  }

  recordTsBlockCreated(): void {
    this.tsBlocksCreated.inc();
  }

  recordTsBlockRemoved(): void {
    this.tsBlocksRemoved.inc();
  }

  setTsPendingReports(count: number): void {
    this.tsPendingReports.set(count);
  }

  setTsActiveBlocksTotal(count: number): void {
    this.tsActiveBlocksTotal.set(count);
  }

  recordTsModerationAction(
    action: 'approve' | 'reject',
    type: string,
    latencySeconds: number = 0,
  ): void {
    this.tsModerationActions.inc({ action, type });
    this.tsModerationQueueLatency.observe({ action }, latencySeconds);
  }

  recordTsDatingRiskScore(score: number): void {
    this.tsDatingRiskScore.observe(score);
  }

  // --- LingQ Reading Engine metric helpers ---

  recordReadingEngineSession(language: string = 'unknown'): void {
    this.readingEngineSessions.inc({ language });
  }

  recordReadingEngineWordsParsed(
    count: number,
    language: string = 'unknown',
  ): void {
    this.readingEngineWordsParsed.inc({ language }, count);
  }

  recordReadingEngineTokenisationDuration(
    language: string,
    durationSeconds: number,
  ): void {
    this.readingEngineTokenisationDuration.observe(
      { language },
      durationSeconds,
    );
  }

  recordReadingEngineAiRequest(endpoint: string, status: string): void {
    this.readingEngineAiRequests.inc({ endpoint, status });
  }

  recordReadingEngineAiRequestDuration(
    endpoint: string,
    durationSeconds: number,
  ): void {
    this.readingEngineAiRequestDuration.observe({ endpoint }, durationSeconds);
  }

  recordReadingEngineAiError(endpoint: string, errorType: string): void {
    this.readingEngineAiErrors.inc({ endpoint, error_type: errorType });
  }

  recordReadingEngineFlashcardSave(
    sourceLanguage: string = 'unknown',
    targetLanguage: string = 'unknown',
  ): void {
    this.readingEngineFlashcardSaves.inc({
      source_language: sourceLanguage,
      target_language: targetLanguage,
    });
  }

  recordReadingEngineSessionDuration(
    language: string,
    durationSeconds: number,
  ): void {
    this.readingEngineSessionDuration.observe({ language }, durationSeconds);
  }

  recordReadingEngineWordLookup(
    sourceLanguage: string = 'unknown',
    targetLanguage: string = 'unknown',
  ): void {
    this.readingEngineUserWordsLookedUp.inc({
      source_language: sourceLanguage,
      target_language: targetLanguage,
    });
  }

  setReadingEngineDailyActiveReaders(count: number): void {
    this.readingEngineDailyActiveReaders.set(count);
  }

  // --- Coin Economy metric helpers ---

  recordCoinPurchase(
    platform: string,
    packageId: string,
    status: 'success' | 'failed' | 'fraud_blocked',
    amountUsdCents: number = 0,
  ): void {
    this.coinPurchaseTotal.inc({ platform, package_id: packageId, status });
    if (status === 'success' && amountUsdCents > 0) {
      this.coinPurchaseValue.inc(
        { platform, package_id: packageId },
        amountUsdCents,
      );
    }
  }

  recordCoinPurchaseError(platform: string, errorType: string): void {
    this.coinPurchaseErrorsTotal.inc({ platform, error_type: errorType });
  }

  recordCoinFraudAttempt(platform: string, reason: string): void {
    this.coinFraudAttemptsTotal.inc({ platform, reason });
  }

  setCoinBalanceTotal(total: number): void {
    this.coinBalanceTotal.set(total);
  }

  setCoinHighBalanceUsers(count: number): void {
    this.coinHighBalanceUsers.set(count);
  }

  recordDailyCheckInClaim(claimed: boolean): void {
    this.coinDailyClaimTotal.inc({ claimed: String(claimed) });
  }

  recordGiftSent(
    giftId: string,
    animationType: string,
    coinValue: number,
  ): void {
    this.coinGiftTotal.inc({ gift_id: giftId, animation_type: animationType });
    this.coinGiftValue.inc({ gift_id: giftId }, coinValue);
  }

  recordStickerPurchase(packId: string, coinCost: number): void {
    this.coinStickerPurchaseTotal.inc({ pack_id: packId });
    this.coinStickerRevenueTotal.inc({ pack_id: packId }, coinCost);
  }

  observeCoinTransactionLatency(
    operation: string,
    durationSeconds: number,
  ): void {
    this.coinTransactionLatency.observe({ operation }, durationSeconds);
  }

  // --- Matchmaking (Recommendations) metric helpers ---

  recordMatchmakingRecommendationsGenerated(
    tier: string,
    endpoint: string,
    count: number = 0,
  ): void {
    this.matchmakingRecommendationsGenerated.inc({ tier, endpoint }, count);
  }

  recordMatchmakingRecommendationsPerRequest(
    tier: string,
    count: number,
  ): void {
    this.matchmakingRecommendationsPerRequest.observe({ tier }, count);
  }

  recordMatchmakingFallbackTierUsed(fromTier: string, toTier: string): void {
    this.matchmakingFallbackTierUsed.inc({
      from_tier: fromTier,
      to_tier: toTier,
    });
  }

  recordMatchmakingEmptyResults(endpoint: string): void {
    this.matchmakingEmptyResultsTotal.inc({ endpoint });
  }

  recordMatchmakingRequestDuration(
    endpoint: string,
    outcome: 'success' | 'empty' | 'error',
    durationSeconds: number,
  ): void {
    this.matchmakingRequestDuration.observe(
      { endpoint, outcome },
      durationSeconds,
    );
  }

  recordMatchmakingDailyCacheMiss(reason: string): void {
    this.matchmakingDailyCacheMisses.inc({ reason });
  }

  setMatchmakingTierSuccessRate(rate: number): void {
    this.matchmakingTierSuccessRate.set(rate);
  }

  // --- Escrow Payment metric helpers ---

  recordEscrowCreated(amountCoins: number): void {
    this.escrowTransactionsCreated.inc({ status: 'held' });
    this.escrowAmountPerTransaction.observe(amountCoins);
  }

  recordEscrowReleased(amountCoins: number): void {
    this.escrowTransactionsReleased.inc();
  }

  recordEscrowRefunded(amountCoins: number, reason: string = 'manual'): void {
    this.escrowTransactionsRefunded.inc({ reason });
  }

  recordEscrowCancelled(amountCoins: number): void {
    this.escrowTransactionsCancelled.inc();
  }

  recordEscrowAutoRefunded(amountCoins: number): void {
    this.escrowAutoRefundCount.inc();
  }

  recordEscrowDegradedOperation(): void {
    this.escrowDegradedQueueSize.inc();
  }

  setEscrowDegradedQueueSize(count: number): void {
    this.escrowDegradedQueueSize.set(count);
  }

  setEscrowStaleHeldCount(count: number): void {
    this.escrowStaleHeldCount.set(count);
  }

  // --- Admin Moderation Dashboard metric helpers ---

  recordAdminBanAction(result: 'success' | 'failure'): void {
    this.adminBanActions.inc({ result });
  }

  recordAdminWarnAction(result: 'success' | 'failure'): void {
    this.adminWarnActions.inc({ result });
  }

  recordAdminVipToggle(result: 'success' | 'failure'): void {
    this.adminVipToggles.inc({ result });
  }

  recordAdminBlockRemoval(result: 'success' | 'failure'): void {
    this.adminBlockRemovals.inc({ result });
  }

  recordAdminReportResolution(
    action: 'approve' | 'reject',
    result: 'success' | 'failure',
  ): void {
    this.adminReportResolutions.inc({ action, result });
  }

  recordAdminApiError(endpoint: string, errorType: string): void {
    this.adminApiErrors.inc({ endpoint, error_type: errorType });
  }

  observeAdminApiLatency(
    endpoint: string,
    action: string,
    durationSeconds: number,
  ): void {
    this.adminApiLatency.observe({ endpoint, action }, durationSeconds);
  }

  setAdminPendingReports(count: number): void {
    this.adminPendingReports.set(count);
  }

  setAdminActiveBlocks(count: number): void {
    this.adminActiveBlocks.set(count);
  }

  recordAdminLoginHistoryRequest(result: 'success' | 'failure'): void {
    this.adminLoginHistoryRequests.inc({ result });
  }

  setModerationQueueSize(count: number): void {
    this.tsPendingReports.set(count);
  }
  setVideoRoomActive(count: number): void {
    this.activeConnections.set(count);
  }
  setVideoRoomParticipants(count: number): void {
    this.activeConnections.set(count);
  }
  recordVideoClassroomCreationFailed(errorType: string): void {
    this.adminApiErrors.inc({
      endpoint: 'video-classroom',
      error_type: errorType,
    });
  }
  recordVideoClassroomTokenGenerationDuration(
    action: string,
    durationSeconds: number,
  ): void {
    this.adminApiLatency.observe(
      { endpoint: 'video-classroom', action },
      durationSeconds,
    );
  }
  recordVideoClassroomCreated(): void {
    this.adminVipToggles.inc({ result: 'created' });
  }
  recordVideoClassroomJoined(): void {
    this.adminVipToggles.inc({ result: 'joined' });
  }
  recordVideoClassroomJoinFailed(errorType: string): void {
    this.adminApiErrors.inc({
      endpoint: 'video-classroom-join',
      error_type: errorType,
    });
  }

  getRegister(): Registry {
    return this.register;
  }

  getContentType(): string {
    return 'text/plain; version=0.0.4';
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }
}
