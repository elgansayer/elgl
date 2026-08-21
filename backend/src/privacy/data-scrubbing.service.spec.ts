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
    it('passes through payer_id and payee_id unmodified (documented policy)', () => {
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

    it('passes through reason unmodified (essential for dispute resolution)', () => {
      const record = {
        payer_id: 'payer-1',
        reason: 'Payment for 30-minute session with Jane',
      };

      service.scrubEscrowRecord(record);

      expect(record.reason).toBe('Payment for 30-minute session with Jane');
    });

    it('passes through metadata unmodified', () => {
      const record = {
        payer_id: 'payer-1',
        metadata: { note: 'contact: jane@example.com', lesson_id: 'abc-123' },
      };

      service.scrubEscrowRecord(record);

      expect(record.metadata).toEqual({
        note: 'contact: jane@example.com',
        lesson_id: 'abc-123',
      });
    });

    it('trims whitespace before scrubbing', () => {
      expect(service.scrubDisplayName('  Maria  ')).toBe('M****');
    });
  });

  describe('scrubEscrowTransactionRecords', () => {
    it('scrubs each escrow record in-place (passes through essential fields)', () => {
      const records = [
        {
          payer_id: 'payer-1',
          payee_id: 'payee-1',
          reason: 'Lesson payment',
          metadata: { type: 'lesson' },
        },
        {
          payer_id: 'payer-2',
          payee_id: 'payee-2',
          reason: 'Translation service',
          metadata: null,
        },
      ];

      records.forEach((r) => service.scrubEscrowRecord(r));

      expect(records[0].payer_id).toBe('payer-1');
      expect(records[0].reason).toBe('Lesson payment');
      expect(records[1].payer_id).toBe('payer-2');
      expect(records[1].reason).toBe('Translation service');
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

  /* ------------------------------------------------------------------ */
  /*  LingQ Reading Engine Scrubbing Tests                              */
  /* ------------------------------------------------------------------ */

  describe('scrubReadingResourceForAdmin', () => {
    it('redacts content and pseudonymises title in-place', () => {
      const record = {
        id: 'res-abc-123',
        title: 'My Personal Diary Entry',
        content: 'Today I met John at the coffee shop on 5th Avenue.',
        language: 'en',
        difficulty: 'B2',
        topic: 'travel',
        sourceUrl: 'https://example.com/article',
        createdBy: 'user-uuid-001',
      };

      service.scrubReadingResourceForAdmin(record);

      expect(record.id).toBe('res-abc-123');
      expect(record.title).toBe('M**********************');
      expect(record.content).toBe('[CONTENT-REDACTED]');
      expect(record.language).toBe('en');
      expect(record.difficulty).toBe('B2');
      expect(record.topic).toBe('travel');
      expect(record.sourceUrl).toBe('https://example.com/article');
      expect(record.createdBy).toBe('user-uuid-001');
    });

    it('handles null fields gracefully', () => {
      const record = {
        title: null,
        content: null,
        language: 'ja',
      };

      expect(() => service.scrubReadingResourceForAdmin(record)).not.toThrow();
      expect(record.title).toBeNull();
      expect(record.content).toBeNull();
    });

    it('redacts only content when title is empty', () => {
      const record = {
        title: '',
        content: 'Sensitive text here',
      };

      service.scrubReadingResourceForAdmin(record);

      expect(record.title).toBe('');
      expect(record.content).toBe('[CONTENT-REDACTED]');
    });
  });

  describe('scrubReadingResourceRecords', () => {
    it('scrubs each record in the array in-place', () => {
      const records = [
        {
          id: 'res-1',
          title: 'My Journal',
          content: 'Secret content',
          language: 'en',
          createdBy: 'user-1',
        },
        {
          id: 'res-2',
          title: 'Notes on Paris trip',
          content: 'Met Maria at Eiffel Tower',
          language: 'fr',
          createdBy: 'user-2',
        },
      ];

      service.scrubReadingResourceRecords(records);

      expect(records[0].content).toBe('[CONTENT-REDACTED]');
      expect(records[0].title).toBe('M*********');
      expect(records[1].content).toBe('[CONTENT-REDACTED]');
      expect(records[1].title).toBe('N******************');
    });

    it('handles an empty array gracefully', () => {
      expect(() => service.scrubReadingResourceRecords([])).not.toThrow();
    });
  });

  describe('scrubReadingProgressForAdmin', () => {
    it('passes through all fields (aggregate metrics, not PII)', () => {
      const record = {
        userId: 'user-uuid-001',
        wordsRead: 5000,
        articlesCompleted: 42,
        totalReadingTimeSeconds: 36000,
        fluencyPercentage: 0.85,
        lastReadAt: '2026-08-07T12:00:00Z',
      };

      service.scrubReadingProgressForAdmin(record);

      expect(record.userId).toBe('user-uuid-001');
      expect(record.wordsRead).toBe(5000);
      expect(record.articlesCompleted).toBe(42);
      expect(record.totalReadingTimeSeconds).toBe(36000);
      expect(record.fluencyPercentage).toBe(0.85);
      expect(record.lastReadAt).toBe('2026-08-07T12:00:00Z');
    });
  });

  describe('scrubReadingProgressRecords', () => {
    it('passes through an array of records', () => {
      const records = [
        { userId: 'u1', wordsRead: 100 },
        { userId: 'u2', wordsRead: 200 },
      ];

      expect(() => service.scrubReadingProgressRecords(records)).not.toThrow();
      expect(records[0].userId).toBe('u1');
      expect(records[1].wordsRead).toBe(200);
    });

    it('handles an empty array gracefully', () => {
      expect(() => service.scrubReadingProgressRecords([])).not.toThrow();
    });
  });

  describe('scrubTranslationCacheForAdmin', () => {
    it('redacts source text and translated text in-place', () => {
      const record = {
        userId: 'user-uuid-001',
        sourceText: 'Bonjour le monde',
        targetLanguage: 'en',
        translatedText: 'Hello world',
      };

      service.scrubTranslationCacheForAdmin(record);

      expect(record.userId).toBe('user-uuid-001');
      expect(record.sourceText).toBe('[TEXT-REDACTED]');
      expect(record.targetLanguage).toBe('en');
      expect(record.translatedText).toBe('[TRANSLATION-REDACTED]');
    });

    it('handles null fields gracefully', () => {
      const record = {
        userId: 'u1',
        sourceText: null,
        targetLanguage: 'es',
        translatedText: null,
      };

      expect(() => service.scrubTranslationCacheForAdmin(record)).not.toThrow();
      expect(record.sourceText).toBeNull();
      expect(record.translatedText).toBeNull();
    });
  });

  describe('scrubTranslationCacheRecords', () => {
    it('redacts array of entries in-place', () => {
      const records = [
        {
          userId: 'u1',
          sourceText: 'Hola',
          targetLanguage: 'en',
          translatedText: 'Hello',
        },
        {
          userId: 'u2',
          sourceText: 'Ciao',
          targetLanguage: 'en',
          translatedText: 'Hi',
        },
      ];

      service.scrubTranslationCacheRecords(records);

      expect(records[0].sourceText).toBe('[TEXT-REDACTED]');
      expect(records[0].translatedText).toBe('[TRANSLATION-REDACTED]');
      expect(records[1].sourceText).toBe('[TEXT-REDACTED]');
      expect(records[1].translatedText).toBe('[TRANSLATION-REDACTED]');
    });

    it('handles an empty array gracefully', () => {
      expect(() => service.scrubTranslationCacheRecords([])).not.toThrow();
    });
  });
});
