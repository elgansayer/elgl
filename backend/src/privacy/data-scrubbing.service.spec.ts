import { Test, TestingModule } from '@nestjs/testing';
import { DataScrubbingService } from './data-scrubbing.service';

// Mock DOMPurify/JSDOM ESM dependencies at module level. These are needed
// because data-scrubbing.service.ts now imports them for escrow scrubbing.
jest.mock('jsdom', () => ({
  JSDOM: jest.fn().mockReturnValue({
    window: {
      document: { createElement: jest.fn() },
      Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
    },
  }),
}));

jest.mock('dompurify', () => {
  const sanitize = jest.fn((dirty: string) => {
    // Simulate real DOMPurify behaviour: strip all HTML tags
    return dirty.replace(/<[^>]*>/g, '');
  });
  const purify = {
    sanitize,
    setConfig: jest.fn(),
  };
  const DOMPurify = jest.fn(() => purify);
  return {
    __esModule: true,
    default: DOMPurify,
  };
});

describe('DataScrubbingService', () => {
  let service: DataScrubbingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DataScrubbingService],
    }).compile();

    service = module.get<DataScrubbingService>(DataScrubbingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scrubIpAddress', () => {
    it('returns null for null/undefined/empty input', () => {
      expect(service.scrubIpAddress(null)).toBeNull();
      expect(service.scrubIpAddress(undefined)).toBeNull();
      expect(service.scrubIpAddress('')).toBeNull();
    });

    it('zeroes the last octet of an IPv4 address', () => {
      expect(service.scrubIpAddress('203.0.113.5')).toBe('203.0.113.0');
      expect(service.scrubIpAddress('192.168.1.100')).toBe('192.168.1.0');
      expect(service.scrubIpAddress('10.0.0.1')).toBe('10.0.0.0');
    });

    it('zeroes host portion of a full IPv6 address', () => {
      expect(
        service.scrubIpAddress('2001:db8:85a3:8d3:1319:8a2e:370:7348'),
      ).toBe('2001:db8:85a3:0:0:0:0:0');
    });

    it('returns unrecognized strings unchanged', () => {
      expect(service.scrubIpAddress('not-an-ip')).toBe('not-an-ip');
      expect(service.scrubIpAddress('localhost')).toBe('localhost');
    });

    it('trims whitespace before scrubbing', () => {
      expect(service.scrubIpAddress('  203.0.113.5  ')).toBe('203.0.113.0');
    });
  });

  describe('scrubLoginHistory', () => {
    it('scrubs ip_address on every entry in place', () => {
      const entries = [
        { ip_address: '203.0.113.5', user_agent: 'Mozilla' },
        { ip_address: '192.168.1.100', user_agent: 'Chrome' },
        { ip_address: null },
        {},
      ];

      service.scrubLoginHistory(entries);

      expect(entries[0].ip_address).toBe('203.0.113.0');
      expect(entries[1].ip_address).toBe('192.168.1.0');
      expect(entries[2].ip_address).toBeNull();
      expect(entries[3].ip_address).toBeUndefined();
    });

    it('handles an empty array gracefully', () => {
      expect(() => service.scrubLoginHistory([])).not.toThrow();
    });
  });

  describe('scrubReceiptToken', () => {
    it('returns null for null/undefined/empty input', () => {
      expect(service.scrubReceiptToken(null)).toBeNull();
      expect(service.scrubReceiptToken(undefined)).toBeNull();
      expect(service.scrubReceiptToken('')).toBeNull();
    });

    it('returns null for tokens of 4 characters or fewer', () => {
      expect(service.scrubReceiptToken('abc')).toBeNull();
      expect(service.scrubReceiptToken('abcd')).toBeNull();
    });

    it('preserves only the last 4 characters with asterisks', () => {
      expect(service.scrubReceiptToken('cs_live_a1b2c3d4e5f6g7h8')).toBe(
        '***g7h8',
      );
      expect(service.scrubReceiptToken('ios_MIIaVeryLongBase64String==')).toBe(
        '***ng==',
      );
    });

    it('handles Stripe session ID format', () => {
      const result = service.scrubReceiptToken('cs_test_a1iKdJfRjLpWm7NqXv3Z');
      expect(result).toBe('***Xv3Z');
      expect(result).not.toContain('cs_test');
    });

    it('handles Apple receipt data', () => {
      const appleReceipt = 'MIJ8dGVzdC1yZWNlaXB0LWRhdGEtaGVyZQ==';
      expect(service.scrubReceiptToken(appleReceipt)).toBe('***ZQ==');
    });

    it('trims whitespace before scrubbing', () => {
      expect(service.scrubReceiptToken('  cs_live_abcdefgh  ')).toBe('***efgh');
    });
  });

  describe('scrubCoinPurchaseRecords', () => {
    it('scrubs receipt_token on every entry in place', () => {
      const records = [
        {
          id: '1',
          receipt_token: 'cs_live_a1b2c3d4e5f6',
          transaction_id: 'txn_123',
          platform: 'web',
        },
        {
          id: '2',
          receipt_token: 'ios_MIIaVeryLongBase64String==',
          transaction_id: 'txn_456',
          platform: 'ios',
        },
        { id: '3', receipt_token: null, transaction_id: 'txn_789' },
        { id: '4' },
      ];

      service.scrubCoinPurchaseRecords(records);

      expect(records[0].receipt_token).toBe('***e5f6');
      expect(records[1].receipt_token).toBe('***ng==');
      expect(records[2].receipt_token).toBeNull();
      expect(records[3].receipt_token).toBeUndefined();

      // transaction_id should be preserved (opaque provider IDs)
      expect(records[0].transaction_id).toBe('txn_123');
      expect(records[1].transaction_id).toBe('txn_456');
    });

    it('handles an empty array gracefully', () => {
      expect(() => service.scrubCoinPurchaseRecords([])).not.toThrow();
    });
  });

  describe('scrubEconomyRecord', () => {
    it('scrubs receipt_token and ip_address in a single record', () => {
      const record = {
        receipt_token: 'cs_live_abcdefghijklmnop',
        ip_address: '203.0.113.42',
        sender_id: 'user-sender-uuid',
        receiver_id: 'user-receiver-uuid',
      };

      service.scrubEconomyRecord(record);

      expect(record.receipt_token).toBe('***mnop');
      expect(record.ip_address).toBe('203.0.113.0');
      // sender_id / receiver_id are internal UUIDs; pass through
      expect(record.sender_id).toBe('user-sender-uuid');
      expect(record.receiver_id).toBe('user-receiver-uuid');
    });

    it('handles null fields gracefully', () => {
      const record = {
        receipt_token: null,
        ip_address: null,
        sender_id: null,
        receiver_id: null,
      };

      expect(() => service.scrubEconomyRecord(record)).not.toThrow();
      expect(record.receipt_token).toBeNull();
      expect(record.ip_address).toBeNull();
    });
  });

  describe('scrubGiftTransactionRecords', () => {
    it('passes through sender_id and receiver_id unmodified (documented policy)', () => {
      const records = [
        { sender_id: 'sender-1', receiver_id: 'receiver-1' },
        { sender_id: 'sender-2', receiver_id: 'receiver-2' },
      ];

      service.scrubGiftTransactionRecords(records);

      expect(records[0].sender_id).toBe('sender-1');
      expect(records[0].receiver_id).toBe('receiver-1');
      expect(records[1].sender_id).toBe('sender-2');
      expect(records[1].receiver_id).toBe('receiver-2');
    });

    it('handles an empty array gracefully', () => {
      expect(() => service.scrubGiftTransactionRecords([])).not.toThrow();
    });
  });

  describe('scrubEscrowRecord', () => {
    it('preserves payer_id and payee_id (internal UUIDs)', () => {
      const record = {
        payer_id: 'payer-uuid-1',
        payee_id: 'payee-uuid-1',
        reason: 'Payment for language lesson',
        metadata: { lesson_type: 'conversation' },
      };

      service.scrubEscrowRecord(record);

      expect(record.payer_id).toBe('payer-uuid-1');
      expect(record.payee_id).toBe('payee-uuid-1');
    });

    it('sanitises HTML/script tags from reason field', () => {
      const record = {
        payer_id: 'payer-1',
        reason: 'Payment <script>alert("xss")</script> for <b>session</b> with Jane',
      };

      service.scrubEscrowRecord(record);

      expect(record.reason).not.toContain('<script>');
      expect(record.reason).not.toContain('<b>');
      expect(record.reason).toContain('alert');
      expect(record.reason).toContain('session');
      expect(record.reason).toContain('Jane');
    });

    it('truncates reason to 500 characters', () => {
      const record = {
        payer_id: 'payer-1',
        reason: 'A'.repeat(600),
      };

      service.scrubEscrowRecord(record);

      expect(record.reason.length).toBeLessThanOrEqual(500);
    });

    it('sanitises HTML in metadata string values', () => {
      const record = {
        payer_id: 'payer-1',
        metadata: { note: '<b>urgent</b>', contact: '<script>evil</script>test@example.com' },
      };

      service.scrubEscrowRecord(record);

      expect(record.metadata.note).toBe('urgent');
      expect(record.metadata.note).not.toContain('<b>');
      expect(record.metadata.contact).toBe('eviltest@example.com');
      expect(record.metadata.contact).not.toContain('<script>');
    });

    it('sanitises HTML in last_error field', () => {
      const record = {
        payer_id: 'payer-1',
        last_error: 'Timeout <img src=x onerror=alert(1)> fetching resource',
      };

      service.scrubEscrowRecord(record);

      expect(record.last_error).not.toContain('<img');
      expect(record.last_error).toContain('Timeout');
      expect(record.last_error).toContain('fetching resource');
    });

    it('handles null and undefined fields gracefully', () => {
      const record = {
        payer_id: null,
        payee_id: null,
        reason: null,
        metadata: null,
        last_error: null,
      };

      expect(() => service.scrubEscrowRecord(record)).not.toThrow();
    });
  });

  describe('scrubEscrowTransactionRecords', () => {
    it('scrubs reason and metadata in each record in-place', () => {
      const records = [
        {
          payer_id: 'payer-1',
          payee_id: 'payee-1',
          reason: 'Lesson payment <script>xss</script>',
          metadata: { type: '<b>lesson</b>' },
        },
        {
          payer_id: 'payer-2',
          payee_id: 'payee-2',
          reason: 'Translation service',
          metadata: null,
        },
      ];

      service.scrubEscrowTransactionRecords(records);

      expect(records[0].payer_id).toBe('payer-1');
      expect(records[0].reason).not.toContain('<script>');
      expect(records[0].reason).toContain('Lesson payment');
      expect(records[0].metadata.type).toBe('lesson');
      expect(records[0].metadata.type).not.toContain('<b>');
      expect(records[1].payer_id).toBe('payer-2');
      expect(records[1].reason).toBe('Translation service');
    });

    it('handles an empty array gracefully', () => {
      expect(() => service.scrubEscrowTransactionRecords([])).not.toThrow();
    });
  });

  describe('scrubCrashReport', () => {
    it('passes through user_id and context unmodified', () => {
      const report = {
        user_id: 'user-uuid-1',
        context: { escrow_id: 'esc-123', payer_id: 'payer-1' },
        error_message: 'Database connection failed',
        stack_trace: 'Error: connect ECONNREFUSED',
      };

      service.scrubCrashReport(report);

      expect(report.user_id).toBe('user-uuid-1');
      expect(report.context).toEqual({
        escrow_id: 'esc-123',
        payer_id: 'payer-1',
      });
      expect(report.error_message).toBe('Database connection failed');
      expect(report.stack_trace).toBe('Error: connect ECONNREFUSED');
    });

    it('handles null fields gracefully', () => {
      const report = {
        user_id: null,
        context: null,
        error_message: null,
        stack_trace: null,
      };

      expect(() => service.scrubCrashReport(report)).not.toThrow();
    });
  });

  describe('scrubCrashReportRecords', () => {
    it('scrubs each report in the array in-place', () => {
      const reports = [
        { user_id: 'user-1', context: { key: 'val' } },
        { user_id: 'user-2', context: null },
      ];

      service.scrubCrashReportRecords(reports);

      expect(reports[0].user_id).toBe('user-1');
      expect(reports[0].context).toEqual({ key: 'val' });
      expect(reports[1].user_id).toBe('user-2');
    });

    it('handles an empty array gracefully', () => {
      expect(() => service.scrubCrashReportRecords([])).not.toThrow();
    });
  });
});
