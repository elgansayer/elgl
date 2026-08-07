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

  getRegister(): Registry {
    return this.register;
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }
}
