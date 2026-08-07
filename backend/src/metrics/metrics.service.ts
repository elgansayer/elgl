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

  // Escrow Payment metrics
  readonly escrowCreated: Counter<string>;
  readonly escrowReleased: Counter<string>;
  readonly escrowRefunded: Counter<string>;
  readonly escrowDisputed: Counter<string>;
  readonly escrowsByStatus: Gauge<string>;
  readonly escrowsValueHeld: Gauge<string>;
  readonly escrowsStuckPending: Gauge<string>;
  readonly escrowDisputeRate: Gauge<string>;
  readonly escrowResolutionDuration: Histogram<string>;

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

    // --- Escrow Metrics ---

    this.escrowCreated = new Counter({
      name: 'hellotalk_escrow_created_total',
      help: 'Total number of escrows created',
      labelNames: ['service_type'],
      registers: [this.register],
    });

    this.escrowReleased = new Counter({
      name: 'hellotalk_escrow_released_total',
      help: 'Total number of escrows released to receiver',
      registers: [this.register],
    });

    this.escrowRefunded = new Counter({
      name: 'hellotalk_escrow_refunded_total',
      help: 'Total number of escrows refunded to sender',
      registers: [this.register],
    });

    this.escrowDisputed = new Counter({
      name: 'hellotalk_escrow_disputed_total',
      help: 'Total number of escrow disputes raised',
      registers: [this.register],
    });

    this.escrowsByStatus = new Gauge({
      name: 'hellotalk_escrows_by_status',
      help: 'Number of escrows per status',
      labelNames: ['status'],
      registers: [this.register],
    });

    this.escrowsValueHeld = new Gauge({
      name: 'hellotalk_escrows_value_held',
      help: 'Total coin value currently held in pending escrows',
      registers: [this.register],
    });

    this.escrowsStuckPending = new Gauge({
      name: 'hellotalk_escrows_stuck_pending',
      help: 'Number of pending escrows older than 24 hours',
      registers: [this.register],
    });

    this.escrowDisputeRate = new Gauge({
      name: 'hellotalk_escrow_dispute_rate',
      help: 'Ratio of disputed escrows to total completed escrows, 0-1',
      registers: [this.register],
    });

    this.escrowResolutionDuration = new Histogram({
      name: 'hellotalk_escrow_resolution_duration_seconds',
      help: 'Time from escrow creation to resolution (release or refund)',
      registers: [this.register],
      buckets: [60, 300, 900, 1800, 3600, 7200, 14400, 86400],
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

  // --- Escrow metric helpers ---

  recordEscrowCreated(serviceType: string = 'other'): void {
    this.escrowCreated.inc({ service_type: serviceType });
  }

  recordEscrowReleased(): void {
    this.escrowReleased.inc();
  }

  recordEscrowRefunded(): void {
    this.escrowRefunded.inc();
  }

  recordEscrowDisputed(): void {
    this.escrowDisputed.inc();
  }

  setEscrowsByStatus(status: string, count: number): void {
    this.escrowsByStatus.set({ status }, count);
  }

  setEscrowsValueHeld(value: number): void {
    this.escrowsValueHeld.set(value);
  }

  setEscrowsStuckPending(count: number): void {
    this.escrowsStuckPending.set(count);
  }

  setEscrowDisputeRate(rate: number): void {
    this.escrowDisputeRate.set(rate);
  }

  recordEscrowResolutionDuration(durationSeconds: number): void {
    this.escrowResolutionDuration.observe(durationSeconds);
  }

  getRegister(): Registry {
    return this.register;
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }
}
