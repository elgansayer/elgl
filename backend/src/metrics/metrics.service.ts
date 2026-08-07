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
  readonly tsReportsTotal: Counter<string>;
  readonly tsReportsPending: Gauge<string>;
  readonly tsBlocksTotal: Counter<string>;
  readonly tsActiveBlocks: Gauge<string>;
  readonly tsSpamDetectionsTotal: Counter<string>;
  readonly tsModerationActionsTotal: Counter<string>;
  readonly tsDatingRiskScore: Histogram<string>;
  readonly tsHighRiskUsers: Gauge<string>;

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

    this.tsReportsTotal = new Counter({
      name: 'hellotalk_trust_safety_reports_total',
      help: 'Total number of user reports submitted',
      labelNames: ['reason_category', 'status'],
      registers: [this.register],
    });

    this.tsReportsPending = new Gauge({
      name: 'hellotalk_trust_safety_reports_pending',
      help: 'Number of pending reports awaiting moderation review',
      registers: [this.register],
    });

    this.tsBlocksTotal = new Counter({
      name: 'hellotalk_trust_safety_blocks_total',
      help: 'Total number of user blocks created',
      registers: [this.register],
    });

    this.tsActiveBlocks = new Gauge({
      name: 'hellotalk_trust_safety_active_blocks',
      help: 'Total number of active block relationships',
      registers: [this.register],
    });

    this.tsSpamDetectionsTotal = new Counter({
      name: 'hellotalk_trust_safety_spam_detections_total',
      help: 'Total number of spam messages detected',
      registers: [this.register],
    });

    this.tsModerationActionsTotal = new Counter({
      name: 'hellotalk_trust_safety_moderation_actions_total',
      help: 'Total number of moderation actions taken',
      labelNames: ['action', 'item_type'],
      registers: [this.register],
    });

    this.tsDatingRiskScore = new Histogram({
      name: 'hellotalk_trust_safety_dating_risk_score',
      help: 'Distribution of dating-behaviour risk scores (0-100)',
      registers: [this.register],
      buckets: [10, 25, 50, 75, 90, 100],
    });

    this.tsHighRiskUsers = new Gauge({
      name: 'hellotalk_trust_safety_high_risk_users',
      help: 'Number of users with dating risk score >= 50 in the last scan window',
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

  // --- Trust & Safety metric helpers ---

  recordTsReport(reasonCategory: string, status: string): void {
    this.tsReportsTotal.inc({ reason_category: reasonCategory, status });
  }

  setTsReportsPending(count: number): void {
    this.tsReportsPending.set(count);
  }

  recordTsBlock(): void {
    this.tsBlocksTotal.inc();
  }

  setTsActiveBlocks(count: number): void {
    this.tsActiveBlocks.set(count);
  }

  recordTsSpamDetection(): void {
    this.tsSpamDetectionsTotal.inc();
  }

  recordTsModerationAction(action: string, itemType: string): void {
    this.tsModerationActionsTotal.inc({ action, item_type: itemType });
  }

  observeTsDatingRiskScore(score: number): void {
    this.tsDatingRiskScore.observe(score);
  }

  setTsHighRiskUsers(count: number): void {
    this.tsHighRiskUsers.set(count);
  }

  getRegister(): Registry {
    return this.register;
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }
}
