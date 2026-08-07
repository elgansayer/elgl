import { Test, TestingModule } from '@nestjs/testing';
import { DataScrubbingService } from './data-scrubbing.service';

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
      expect(service.scrubIpAddress('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe(
        '2001:db8:85a3:0:0:0:0:0',
      );
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
      expect(service.scrubReceiptToken('cs_live_a1b2c3d4e5f6g7h8')).toBe('***g7h8');
      expect(service.scrubReceiptToken('ios_MIIaVeryLongBase64String==')).toBe('***ng==');
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
  describe('scrubDisplayName', () => {
    it('returns null for null/undefined/empty input', () => {
      expect(service.scrubDisplayName(null)).toBeNull();
      expect(service.scrubDisplayName(undefined)).toBeNull();
      expect(service.scrubDisplayName('')).toBeNull();
    });

    it('preserves first character and replaces rest with asterisks', () => {
      expect(service.scrubDisplayName('Maria')).toBe('M****');
      expect(service.scrubDisplayName('John')).toBe('J***');
      expect(service.scrubDisplayName('Alexandre')).toBe('A********');
    });

    it('fully replaces names of 2 characters or fewer with asterisks', () => {
      expect(service.scrubDisplayName('Li')).toBe('**');
      expect(service.scrubDisplayName('A')).toBe('*');
      expect(service.scrubDisplayName('Bo')).toBe('**');
    });

    it('trims whitespace before scrubbing', () => {
      expect(service.scrubDisplayName('  Maria  ')).toBe('M****');
    });
  });

  describe('scrubAvatarUrl', () => {
    it('returns null for null/undefined/empty input', () => {
      expect(service.scrubAvatarUrl(null)).toBeNull();
      expect(service.scrubAvatarUrl(undefined)).toBeNull();
      expect(service.scrubAvatarUrl('')).toBeNull();
    });

    it('returns redacted marker for any non-empty URL', () => {
      expect(service.scrubAvatarUrl('https://example.com/avatar.jpg')).toBe(
        '[AVATAR-REDACTED]',
      );
      expect(service.scrubAvatarUrl('http://img/1.png')).toBe(
        '[AVATAR-REDACTED]',
      );
    });
  });

  describe('scrubUserProfileForAdmin', () => {
    it('scrubs display_name, avatar_url, audio_intro_url, and bio_text in-place', () => {
      const record = {
        display_name: 'Maria',
        avatar_url: 'https://example.com/avatar.jpg',
        audio_intro_url: 'https://example.com/intro.mp3',
        bio_text: 'Hello, I love learning languages!',
      };

      service.scrubUserProfileForAdmin(record);

      expect(record.display_name).toBe('M****');
      expect(record.avatar_url).toBe('[AVATAR-REDACTED]');
      expect(record.audio_intro_url).toBe('[AUDIO-REDACTED]');
      expect(record.bio_text).toBe('[BIO-REDACTED]');
    });

    it('handles null fields gracefully', () => {
      const record = {
        display_name: null,
        avatar_url: null,
        audio_intro_url: null,
        bio_text: null,
      };

      expect(() => service.scrubUserProfileForAdmin(record)).not.toThrow();
      expect(record.display_name).toBeNull();
      expect(record.avatar_url).toBeNull();
      expect(record.audio_intro_url).toBeNull();
      expect(record.bio_text).toBeNull();
    });

    it('handles undefined fields gracefully', () => {
      const record = {} as {
        display_name?: string | null;
        avatar_url?: string | null;
        audio_intro_url?: string | null;
        bio_text?: string | null;
      };

      expect(() => service.scrubUserProfileForAdmin(record)).not.toThrow();
      expect(record.display_name).toBeUndefined();
      expect(record.avatar_url).toBeUndefined();
    });
  });

  describe('scrubRecommendationRecords', () => {
    it('scrubs displayName and avatarUrl in-place, passes through other fields', () => {
      const records = [
        {
          id: 'user-1',
          displayName: 'Maria',
          avatarUrl: 'https://example.com/avatar.jpg',
          nativeLanguage: 'en',
          targetLanguages: ['es', 'fr'],
          sharedInterests: 3,
          isSeriousLearner: true,
          studyStreakDays: 30,
          correctionRatio: 0.95,
          matchTier: 'interest',
        },
        {
          id: 'user-2',
          displayName: 'John',
          avatarUrl: null,
          nativeLanguage: 'fr',
          targetLanguages: ['en'],
          sharedInterests: 0,
          isSeriousLearner: false,
          studyStreakDays: 5,
          correctionRatio: 0.5,
          matchTier: 'active_users',
        },
      ];

      service.scrubRecommendationRecords(records);

      expect(records[0].id).toBe('user-1');
      expect(records[0].displayName).toBe('M****');
      expect(records[0].avatarUrl).toBe('[AVATAR-REDACTED]');
      expect(records[0].nativeLanguage).toBe('en');
      expect(records[0].targetLanguages).toEqual(['es', 'fr']);
      expect(records[0].sharedInterests).toBe(3);
      expect(records[0].isSeriousLearner).toBe(true);
      expect(records[0].studyStreakDays).toBe(30);
      expect(records[0].correctionRatio).toBe(0.95);
      expect(records[0].matchTier).toBe('interest');

      expect(records[1].id).toBe('user-2');
      expect(records[1].displayName).toBe('J***');
      expect(records[1].avatarUrl).toBeNull();
      expect(records[1].matchTier).toBe('active_users');
    });

    it('handles an empty array gracefully', () => {
      expect(() => service.scrubRecommendationRecords([])).not.toThrow();
    });

    it('handles null displayName fields gracefully', () => {
      const records = [
        {
          id: 'user-3',
          displayName: null,
          avatarUrl: null,
          nativeLanguage: null,
          targetLanguages: null,
          sharedInterests: 0,
          isSeriousLearner: null,
          studyStreakDays: null,
          correctionRatio: null,
        },
      ];

      expect(() => service.scrubRecommendationRecords(records)).not.toThrow();
      expect(records[0].displayName).toBeNull();
      expect(records[0].avatarUrl).toBeNull();
    });
  });
});
