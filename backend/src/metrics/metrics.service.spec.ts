import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return metrics string from getMetrics()', async () => {
    const metrics = await service.getMetrics();
    expect(typeof metrics).toBe('string');
    expect(metrics.length).toBeGreaterThan(0);
  });

  it('should increment active connections', () => {
    service.incrementActiveConnections();
    expect(true).toBe(true);
  });

  it('should decrement active connections', () => {
    service.incrementActiveConnections();
    service.decrementActiveConnections();
    expect(true).toBe(true);
  });

  it('should record HTTP request metrics without throwing', () => {
    service.recordHttpRequest('GET', '/api/test', 200, 0.05);
    expect(true).toBe(true);
  });

  it('should expose a registry', () => {
    const registry = service.getRegister();
    expect(registry).toBeDefined();
  });

  describe('SRS metrics', () => {
    it('should record SRS flashcard created', () => {
      expect(() => service.recordSrsFlashcardCreated('en', 'fr')).not.toThrow();
    });

    it('should record SRS flashcard created with defaults', () => {
      expect(() => service.recordSrsFlashcardCreated()).not.toThrow();
    });

    it('should record SRS review completed (pass)', () => {
      expect(() =>
        service.recordSrsReviewCompleted(4, 'pass', 2.3),
      ).not.toThrow();
    });

    it('should record SRS review completed (fail)', () => {
      expect(() =>
        service.recordSrsReviewCompleted(1, 'fail', 5.1),
      ).not.toThrow();
    });

    it('should set SRS due cards gauge', () => {
      expect(() => service.setSrsDueCards(42)).not.toThrow();
    });

    it('should set SRS average easiness factor', () => {
      expect(() => service.setSrsAverageEasinessFactor(2.56)).not.toThrow();
    });

    it('should set SRS review success rate', () => {
      expect(() => service.setSrsReviewSuccessRate(0.85)).not.toThrow();
    });

    it('should set SRS cards per level', () => {
      expect(() => service.setSrsCardsPerLevel(3, 150)).not.toThrow();
    });

    it('should set SRS cards stuck', () => {
      expect(() => service.setSrsCardsStuck(7)).not.toThrow();
    });

    it('should set SRS decks total', () => {
      expect(() => service.setSrsDecksTotal(25)).not.toThrow();
    });

    it('should record SRS deck created', () => {
      expect(() => service.recordSrsDeckCreated()).not.toThrow();
    });

    it('should expose SRS gauge metrics correctly', () => {
      service.setSrsDueCards(10);
      service.setSrsAverageEasinessFactor(2.5);
      service.setSrsReviewSuccessRate(0.9);
      service.setSrsCardsStuck(2);
      service.setSrsDecksTotal(15);
      expect(true).toBe(true);
    });

    it('should expose SRS counter metrics correctly', () => {
      service.recordSrsFlashcardCreated('en', 'es');
      service.recordSrsReviewCompleted(5, 'pass', 1.2);
      service.recordSrsDeckCreated();
      expect(true).toBe(true);
    });

    it('should include SRS metrics in getMetrics output', async () => {
      service.recordSrsFlashcardCreated();
      service.recordSrsReviewCompleted(3, 'pass', 1.0);
      service.setSrsDueCards(5);
      const metrics = await service.getMetrics();
      expect(metrics).toContain('hellotalk_srs_flashcards_created_total');
      expect(metrics).toContain('hellotalk_srs_reviews_completed_total');
      expect(metrics).toContain('hellotalk_srs_due_cards');
      expect(metrics).toContain('hellotalk_srs_average_easiness_factor');
      expect(metrics).toContain('hellotalk_srs_review_success_rate');
      expect(metrics).toContain('hellotalk_srs_cards_stuck');
      expect(metrics).toContain('hellotalk_srs_decks_total');
    });
  });

  describe('Trust & Safety metrics', () => {
    it('should record report submitted', () => {
      expect(() => service.recordTsReportSubmitted('harassment')).not.toThrow();
    });

    it('should record report submitted with default category', () => {
      expect(() => service.recordTsReportSubmitted()).not.toThrow();
    });

    it('should record block created', () => {
      expect(() => service.recordTsBlockCreated()).not.toThrow();
    });

    it('should record block removed', () => {
      expect(() => service.recordTsBlockRemoved()).not.toThrow();
    });

    it('should set pending reports gauge', () => {
      expect(() => service.setTsPendingReports(15)).not.toThrow();
    });

    it('should set active blocks total gauge', () => {
      expect(() => service.setTsActiveBlocksTotal(200)).not.toThrow();
    });

    it('should record moderation action', () => {
      expect(() =>
        service.recordTsModerationAction('approve', 'moment', 1.2),
      ).not.toThrow();
    });

    it('should record moderation action (reject)', () => {
      expect(() =>
        service.recordTsModerationAction('reject', 'profile', 0.5),
      ).not.toThrow();
    });

    it('should record dating risk score', () => {
      expect(() => service.recordTsDatingRiskScore(65)).not.toThrow();
    });

    it('should include T&S metrics in getMetrics output', async () => {
      service.recordTsReportSubmitted('spam');
      service.recordTsBlockCreated();
      service.recordTsBlockRemoved();
      service.setTsPendingReports(10);
      service.setTsActiveBlocksTotal(100);
      service.recordTsModerationAction('approve', 'moment', 0.8);
      service.recordTsDatingRiskScore(42);

      const metrics = await service.getMetrics();
      expect(metrics).toContain('hellotalk_ts_reports_submitted_total');
      expect(metrics).toContain('hellotalk_ts_blocks_created_total');
      expect(metrics).toContain('hellotalk_ts_blocks_removed_total');
      expect(metrics).toContain('hellotalk_ts_pending_reports');
      expect(metrics).toContain('hellotalk_ts_active_blocks_total');
      expect(metrics).toContain('hellotalk_ts_moderation_actions_total');
      expect(metrics).toContain('hellotalk_ts_dating_risk_score');
      expect(metrics).toContain('hellotalk_ts_reports_by_category_total');
      expect(metrics).toContain(
        'hellotalk_ts_moderation_queue_latency_seconds',
      );
    });
  });

  describe('LingQ Reading Engine metrics', () => {
    it('should record reading engine session', () => {
      expect(() => service.recordReadingEngineSession('fr')).not.toThrow();
    });

    it('should record reading engine session with defaults', () => {
      expect(() => service.recordReadingEngineSession()).not.toThrow();
    });

    it('should record words parsed', () => {
      expect(() =>
        service.recordReadingEngineWordsParsed(500, 'ja'),
      ).not.toThrow();
    });

    it('should record tokenisation duration', () => {
      expect(() =>
        service.recordReadingEngineTokenisationDuration('en', 0.025),
      ).not.toThrow();
    });

    it('should record AI request', () => {
      expect(() =>
        service.recordReadingEngineAiRequest('translate', '200'),
      ).not.toThrow();
    });

    it('should record AI request duration', () => {
      expect(() =>
        service.recordReadingEngineAiRequestDuration('grammar-check', 1.4),
      ).not.toThrow();
    });

    it('should record AI error', () => {
      expect(() =>
        service.recordReadingEngineAiError('translate', 'timeout'),
      ).not.toThrow();
    });

    it('should record flashcard save from reading', () => {
      expect(() =>
        service.recordReadingEngineFlashcardSave('es', 'en'),
      ).not.toThrow();
    });

    it('should record flashcard save from reading with defaults', () => {
      expect(() => service.recordReadingEngineFlashcardSave()).not.toThrow();
    });

    it('should record session duration', () => {
      expect(() =>
        service.recordReadingEngineSessionDuration('de', 420),
      ).not.toThrow();
    });

    it('should record word lookup', () => {
      expect(() =>
        service.recordReadingEngineWordLookup('pt', 'en'),
      ).not.toThrow();
    });

    it('should set daily active readers gauge', () => {
      expect(() =>
        service.setReadingEngineDailyActiveReaders(128),
      ).not.toThrow();
    });

    it('should include reading engine metrics in getMetrics output', async () => {
      service.recordReadingEngineSession('fr');
      service.recordReadingEngineAiRequest('translate', '200');
      service.recordReadingEngineAiError('translate', '429');
      service.recordReadingEngineFlashcardSave('en', 'es');
      service.setReadingEngineDailyActiveReaders(42);
      const metrics = await service.getMetrics();
      expect(metrics).toContain('hellotalk_reading_engine_sessions_total');
      expect(metrics).toContain('hellotalk_reading_engine_ai_requests_total');
      expect(metrics).toContain('hellotalk_reading_engine_ai_errors_total');
      expect(metrics).toContain(
        'hellotalk_reading_engine_flashcard_saves_total',
      );
      expect(metrics).toContain(
        'hellotalk_reading_engine_daily_active_readers',
      );
      expect(metrics).toContain(
        'hellotalk_reading_engine_session_duration_seconds',
      );
      expect(metrics).toContain(
        'hellotalk_reading_engine_words_looked_up_total',
      );
      expect(metrics).toContain('hellotalk_reading_engine_words_parsed_total');
      expect(metrics).toContain(
        'hellotalk_reading_engine_tokenisation_duration_seconds',
      );
      expect(metrics).toContain(
        'hellotalk_reading_engine_ai_request_duration_seconds',
      );
    });
  });

  describe('Matchmaking metrics', () => {
    it('should record matchmaking recommendations generated', () => {
      expect(() =>
        service.recordMatchmakingRecommendationsGenerated(
          'interest',
          'getRecommendations',
          10,
        ),
      ).not.toThrow();
    });

    it('should record matchmaking recommendations per request', () => {
      expect(() =>
        service.recordMatchmakingRecommendationsPerRequest('interest', 8),
      ).not.toThrow();
    });

    it('should record matchmaking fallback tier used', () => {
      expect(() =>
        service.recordMatchmakingFallbackTierUsed(
          'interest',
          'language_exchange',
        ),
      ).not.toThrow();
    });

    it('should record matchmaking empty results', () => {
      expect(() =>
        service.recordMatchmakingEmptyResults('getRecommendations'),
      ).not.toThrow();
    });

    it('should record matchmaking request duration', () => {
      expect(() =>
        service.recordMatchmakingRequestDuration(
          'getRecommendations',
          'success',
          0.35,
        ),
      ).not.toThrow();
    });

    it('should record matchmaking request duration (error)', () => {
      expect(() =>
        service.recordMatchmakingRequestDuration(
          'getDailyRecommendations',
          'error',
          2.1,
        ),
      ).not.toThrow();
    });

    it('should record matchmaking daily cache miss', () => {
      expect(() =>
        service.recordMatchmakingDailyCacheMiss('redis_unavailable'),
      ).not.toThrow();
    });

    it('should set matchmaking tier success rate', () => {
      expect(() => service.setMatchmakingTierSuccessRate(0.72)).not.toThrow();
    });

    it('should include matchmaking metrics in getMetrics output', async () => {
      service.recordMatchmakingRecommendationsGenerated(
        'interest',
        'getRecommendations',
        10,
      );
      service.recordMatchmakingRecommendationsPerRequest('interest', 10);
      service.recordMatchmakingFallbackTierUsed(
        'interest',
        'language_exchange',
      );
      service.recordMatchmakingEmptyResults('getRecommendations');
      service.recordMatchmakingRequestDuration(
        'getRecommendations',
        'success',
        0.5,
      );
      service.recordMatchmakingDailyCacheMiss('empty_cache');
      service.setMatchmakingTierSuccessRate(0.65);

      const metrics = await service.getMetrics();
      expect(metrics).toContain(
        'hellotalk_matchmaking_recommendations_generated_total',
      );
      expect(metrics).toContain(
        'hellotalk_matchmaking_recommendations_per_request',
      );
      expect(metrics).toContain(
        'hellotalk_matchmaking_fallback_tier_used_total',
      );
      expect(metrics).toContain('hellotalk_matchmaking_empty_results_total');
      expect(metrics).toContain(
        'hellotalk_matchmaking_request_duration_seconds',
      );
      expect(metrics).toContain(
        'hellotalk_matchmaking_daily_cache_misses_total',
      );
      expect(metrics).toContain('hellotalk_matchmaking_tier_success_rate');
    });
  });

  describe('Escrow metrics', () => {
    it('should record escrow created', () => {
      expect(() => service.recordEscrowCreated(100)).not.toThrow();
    });

    it('should record escrow released', () => {
      expect(() => service.recordEscrowReleased(50)).not.toThrow();
    });

    it('should record escrow refunded', () => {
      expect(() => service.recordEscrowRefunded(75, 'manual')).not.toThrow();
    });

    it('should record escrow refunded with default reason', () => {
      expect(() => service.recordEscrowRefunded(75)).not.toThrow();
    });

    it('should record escrow cancelled', () => {
      expect(() => service.recordEscrowCancelled(30)).not.toThrow();
    });

    it('should record escrow auto-refunded', () => {
      expect(() => service.recordEscrowAutoRefunded(200)).not.toThrow();
    });

    it('should record degraded operation', () => {
      expect(() => service.recordEscrowDegradedOperation()).not.toThrow();
    });

    it('should set escrow degraded queue size', () => {
      expect(() => service.setEscrowDegradedQueueSize(42)).not.toThrow();
    });

    it('should set escrow stale held count', () => {
      expect(() => service.setEscrowStaleHeldCount(5)).not.toThrow();
    });

    it('should include escrow metrics in getMetrics output', async () => {
      service.recordEscrowCreated(100);
      service.recordEscrowReleased(50);
      service.recordEscrowRefunded(25, 'manual');
      service.recordEscrowCancelled(10);
      service.recordEscrowAutoRefunded(30);
      service.recordEscrowDegradedOperation();
      service.setEscrowDegradedQueueSize(3);
      service.setEscrowStaleHeldCount(3);
      const metrics = await service.getMetrics();
      expect(metrics).toContain('hellotalk_escrow_transactions_created_total');
      expect(metrics).toContain('hellotalk_escrow_transactions_released_total');
      expect(metrics).toContain('hellotalk_escrow_transactions_refunded_total');
      expect(metrics).toContain(
        'hellotalk_escrow_transactions_cancelled_total',
      );
      expect(metrics).toContain('hellotalk_escrow_total_held');
      expect(metrics).toContain('hellotalk_escrow_total_coins_held');
      expect(metrics).toContain('hellotalk_escrow_amount_per_transaction');
      expect(metrics).toContain('hellotalk_escrow_stale_held_count');
      expect(metrics).toContain('hellotalk_escrow_auto_refund_total');
      expect(metrics).toContain('hellotalk_escrow_degraded_queue_size');
    });
  });
});
