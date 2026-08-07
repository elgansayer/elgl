import { Test, TestingModule } from '@nestjs/testing';
import { GdprDataScrubbingService } from './gdpr-data-scrubbing.service';

describe('GdprDataScrubbingService', () => {
  let service: GdprDataScrubbingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GdprDataScrubbingService],
    }).compile();

    service = module.get<GdprDataScrubbingService>(GdprDataScrubbingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scrubFreeText', () => {
    it('should return empty string for falsy input', () => {
      expect(service.scrubFreeText('')).toBe('');
    });

    it('should remove email addresses', () => {
      const result = service.scrubFreeText(
        'Contact me at user@example.com for details',
      );
      expect(result).not.toContain('user@example.com');
      expect(result).toContain('[EMAIL]');
    });

    it('should remove phone numbers', () => {
      const result = service.scrubFreeText('Call +1-555-123-4567 for support');
      expect(result).not.toContain('+1-555-123-4567');
      expect(result).toContain('[PHONE]');
    });

    it('should remove credit card numbers', () => {
      const result = service.scrubFreeText('Card: 4111-1111-1111-1111');
      expect(result).not.toContain('4111-1111-1111-1111');
      expect(result).toContain('[CREDIT_CARD]');
    });

    it('should remove Stripe payment intent IDs', () => {
      const result = service.scrubFreeText(
        'Payment: pi_3NqjklAkl234567890ABCDEF',
      );
      expect(result).not.toContain('pi_3NqjklAkl234567890ABCDEF');
      expect(result).toContain('[STRIPE_PI]');
    });

    it('should leave clean text unchanged', () => {
      const clean = 'This is a normal transaction note';
      expect(service.scrubFreeText(clean)).toBe(clean);
    });

    it('should handle multiple PII types in one string', () => {
      const result = service.scrubFreeText(
        'Email: test@test.com, phone: 555-1234, card: 4111111111111111',
      );
      expect(result).toContain('[EMAIL]');
      expect(result).toContain('[PHONE]');
      expect(result).toContain('[CREDIT_CARD]');
    });
  });

  describe('detectPii', () => {
    it('should return no PII for clean text', () => {
      const result = service.detectPii('This is clean text');
      expect(result.hasPii).toBe(false);
      expect(result.piiFields).toHaveLength(0);
    });

    it('should detect email as PII', () => {
      const result = service.detectPii('Email: test@example.com');
      expect(result.hasPii).toBe(true);
      expect(result.piiFields).toContain('EMAIL');
    });

    it('should detect phone as PII', () => {
      const result = service.detectPii('Call 555-123-4567');
      expect(result.hasPii).toBe(true);
      expect(result.piiFields).toContain('PHONE');
    });

    it('should handle empty string', () => {
      const result = service.detectPii('');
      expect(result.hasPii).toBe(false);
      expect(result.piiFields).toHaveLength(0);
    });
  });

  describe('scrubTransactionData', () => {
    it('should scrub transaction_subject and description', () => {
      const data = {
        id: 'escrow-123',
        transaction_subject: 'Payment for lesson with user@test.com',
        description: 'Contact me at 555-1234',
        status: 'completed',
        is_data_scrubbed: false,
      };
      const { scrubbed, result } = service.scrubTransactionData(data);
      expect(scrubbed.transaction_subject).toContain('[EMAIL]');
      expect(scrubbed.description).toContain('[PHONE]');
      expect(scrubbed.is_data_scrubbed).toBe(true);
      expect(scrubbed.gdpr_scrubbed_at).toBeDefined();
      expect(result.transaction_id).toBe('escrow-123');
      expect(result.scrubbed_fields).toContain('transaction_subject');
      expect(result.scrubbed_fields).toContain('description');
    });

    it('should handle missing optional fields', () => {
      const data = {
        id: 'escrow-456',
        transaction_subject: 'Clean subject',
        status: 'completed',
        is_data_scrubbed: false,
      };
      const { scrubbed, result } = service.scrubTransactionData(data);
      expect(scrubbed.transaction_subject).toBe('Clean subject');
      expect(result.scrubbed_fields).toContain('transaction_subject');
      expect(result.scrubbed_fields).not.toContain('description');
    });
  });

  describe('calculateRetentionDate', () => {
    it('should default to 7 years from now', () => {
      const retention = service.calculateRetentionDate();
      const sevenYears = new Date();
      sevenYears.setFullYear(sevenYears.getFullYear() + 7);
      const diffMs = Math.abs(retention.getTime() - sevenYears.getTime());
      expect(diffMs).toBeLessThan(60000); // within a minute
    });

    it('should calculate 7 years from completion date', () => {
      const completionDate = new Date('2020-01-15');
      const retention = service.calculateRetentionDate(completionDate);
      expect(retention.getFullYear()).toBe(2027);
      expect(retention.getMonth()).toBe(0); // January
      expect(retention.getDate()).toBe(15);
    });
  });

  describe('isRetentionExpired', () => {
    it('should return true for past dates', () => {
      const past = new Date();
      past.setFullYear(past.getFullYear() - 1);
      expect(service.isRetentionExpired(past.toISOString())).toBe(true);
    });

    it('should return false for future dates', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 10);
      expect(service.isRetentionExpired(future.toISOString())).toBe(false);
    });
  });
});
