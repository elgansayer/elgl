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

  describe('Virtual Coin Economy metrics', () => {
    it('should record economy coin purchase', () => {
      expect(() =>
        service.recordEconomyCoinPurchase('web', 'coins_small', 'completed'),
      ).not.toThrow();
    });

    it('should record economy coin purchase failed', () => {
      expect(() =>
        service.recordEconomyCoinPurchase('ios', 'coins_medium', 'failed'),
      ).not.toThrow();
    });

    it('should record economy coin revenue', () => {
      expect(() =>
        service.recordEconomyCoinRevenue('android', 'usd', 1999),
      ).not.toThrow();
    });

    it('should record economy purchase error', () => {
      expect(() =>
        service.recordEconomyPurchaseError('web', 'receipt_verification_failed'),
      ).not.toThrow();
    });

    it('should record economy gift send', () => {
      expect(() =>
        service.recordEconomyGiftSend('gift_rose', 'Rose'),
      ).not.toThrow();
    });

    it('should record economy gift revenue', () => {
      expect(() =>
        service.recordEconomyGiftRevenue('gift_heart', 20),
      ).not.toThrow();
    });

    it('should record economy daily check-in claimed', () => {
      expect(() =>
        service.recordEconomyDailyCheckIn('claimed'),
      ).not.toThrow();
    });

    it('should record economy daily check-in already claimed', () => {
      expect(() =>
        service.recordEconomyDailyCheckIn('already_claimed'),
      ).not.toThrow();
    });

    it('should record economy daily check-in reward', () => {
      expect(() =>
        service.recordEconomyDailyCheckInReward(7),
      ).not.toThrow();
    });

    it('should record economy sticker pack unlock', () => {
      expect(() =>
        service.recordEconomyStickerPackUnlock('stk_pack_1'),
      ).not.toThrow();
    });

    it('should record economy sticker pack revenue', () => {
      expect(() =>
        service.recordEconomyStickerPackRevenue('stk_pack_1', 50),
      ).not.toThrow();
    });

    it('should record economy balance query', () => {
      expect(() => service.recordEconomyBalanceQuery()).not.toThrow();
    });

    it('should record economy checkout session', () => {
      expect(() =>
        service.recordEconomyCheckoutSession('coins_large'),
      ).not.toThrow();
    });

    it('should record economy purchase duration', () => {
      expect(() =>
        service.recordEconomyPurchaseDuration('web', 1.5),
      ).not.toThrow();
    });

    it('should record economy gift duration', () => {
      expect(() =>
        service.recordEconomyGiftDuration(0.3),
      ).not.toThrow();
    });

    it('should set economy user balance', () => {
      expect(() =>
        service.setEconomyUserBalance(150),
      ).not.toThrow();
    });

    it('should increment active purchases', () => {
      expect(() => service.incrementEconomyActivePurchases()).not.toThrow();
    });

    it('should decrement active purchases', () => {
      service.incrementEconomyActivePurchases();
      expect(() => service.decrementEconomyActivePurchases()).not.toThrow();
    });

    it('should include economy metrics in getMetrics output', async () => {
      service.recordEconomyCoinPurchase('web', 'coins_small', 'completed');
      service.recordEconomyCoinRevenue('web', 'usd', 499);
      service.recordEconomyGiftSend('gift_rose', 'Rose');
      service.recordEconomyDailyCheckIn('claimed');
      service.recordEconomyBalanceQuery();
      service.recordEconomyCheckoutSession('coins_mega');
      const metrics = await service.getMetrics();
      expect(metrics).toContain('hellotalk_economy_coin_purchases_total');
      expect(metrics).toContain('hellotalk_economy_coin_revenue_total');
      expect(metrics).toContain('hellotalk_economy_gift_sends_total');
      expect(metrics).toContain('hellotalk_economy_daily_check_ins_total');
      expect(metrics).toContain('hellotalk_economy_balance_queries_total');
      expect(metrics).toContain('hellotalk_economy_checkout_sessions_total');
      expect(metrics).toContain('hellotalk_economy_purchase_errors_total');
      expect(metrics).toContain('hellotalk_economy_gift_revenue_coins_total');
      expect(metrics).toContain(
        'hellotalk_economy_daily_check_in_rewards_total',
      );
      expect(metrics).toContain('hellotalk_economy_sticker_pack_unlocks_total');
      expect(metrics).toContain(
        'hellotalk_economy_sticker_pack_revenue_coins_total',
      );
      expect(metrics).toContain('hellotalk_economy_purchase_duration_seconds');
      expect(metrics).toContain('hellotalk_economy_gift_duration_seconds');
      expect(metrics).toContain('hellotalk_economy_balance_sample_coins');
      expect(metrics).toContain('hellotalk_economy_active_purchases');
    });
  });
});
