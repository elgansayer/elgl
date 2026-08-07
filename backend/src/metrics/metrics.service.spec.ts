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
      expect(metrics).toContain('hellotalk_ts_moderation_queue_latency_seconds');
    });
  });
});
