// Mock jsdom and dompurify at module level to avoid parsing ESM dependencies
vi.mock('jsdom', () => ({
  JSDOM: vi.fn().mockImplementation(function () {
    return {
      window: {
        document: {
          createElement: vi.fn(),
          createDocumentFragment: vi.fn(),
        },
        Node: {
          ELEMENT_NODE: 1,
          TEXT_NODE: 3,
          DOCUMENT_FRAGMENT_NODE: 11,
        },
        NodeFilter: {
          SHOW_ELEMENT: 1,
          SHOW_TEXT: 4,
        },
      },
    };
  }),
}));

// Strict mock: strip ALL HTML tags (mirrors the empty ALLOWED_TAGS config)
const { mockStrictSanitize, mockSetConfig } = vi.hoisted(() => {
  const mockStrictSanitize = (dirty: string): string => {
    if (typeof dirty !== 'string') return dirty;
    return dirty
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'");
  };

  const mockSetConfig = vi.fn();
  return { mockStrictSanitize, mockSetConfig };
});

vi.mock('dompurify', () => {
  return {
    __esModule: true,
    default: vi.fn(() => ({
      sanitize: mockStrictSanitize,
      setConfig: mockSetConfig,
    })),
  };
});

import {
  sanitiseEconomyData,
  scrubReceiptToken,
  scrubCoinPurchaseForArchive,
  scrubCoinPurchasesForArchive,
} from './sanitise-economy.helper';

describe('sanitiseEconomyData', () => {
  it('should strip all HTML tags from strings', () => {
    expect(sanitiseEconomyData('<b>bold</b>')).toBe('bold');
    expect(sanitiseEconomyData('<script>alert("xss")</script>')).toBe(
      'alert("xss")',
    );
    expect(sanitiseEconomyData('<a href="javascript:alert(1)">link</a>')).toBe(
      'link',
    );
  });

  it('should strip event handler attributes', () => {
    expect(sanitiseEconomyData('<div onclick="steal()">click</div>')).toBe(
      'click',
    );
    expect(sanitiseEconomyData('<img src=x onerror="alert(1)">')).toBe('');
  });

  it('should sanitise nested objects deeply', () => {
    const input = {
      name: '<b>Rose</b>',
      icon: '🌹',
      animation_url: 'https://r2.example.com/rose.json',
      meta: {
        description: '<p>A <em>beautiful</em> rose</p>',
      },
    };
    const result = sanitiseEconomyData(input) as Record<string, unknown>;
    expect(result['name']).toBe('Rose');
    expect(result['icon']).toBe('🌹');
    expect(result['animation_url']).toBe('https://r2.example.com/rose.json');
    expect((result['meta'] as Record<string, unknown>)['description']).toBe(
      'A beautiful rose',
    );
  });

  it('should sanitise arrays of objects', () => {
    const input = [
      { name: '<b>Rose</b>', cost_coins: 10 },
      { name: '<i>Heart</i>', cost_coins: 20 },
    ];
    const result = sanitiseEconomyData(input) as Array<Record<string, unknown>>;
    expect(result[0]['name']).toBe('Rose');
    expect(result[0]['cost_coins']).toBe(10);
    expect(result[1]['name']).toBe('Heart');
    expect(result[1]['cost_coins']).toBe(20);
  });

  it('should return primitives unchanged', () => {
    expect(sanitiseEconomyData(null)).toBeNull();
    expect(sanitiseEconomyData(undefined)).toBeUndefined();
    expect(sanitiseEconomyData(123)).toBe(123);
    expect(sanitiseEconomyData(true)).toBe(true);
    expect(sanitiseEconomyData(0)).toBe(0);
    expect(sanitiseEconomyData('')).toBe('');
  });

  it('should not traverse class instances', () => {
    class CustomClass {
      a = '<b>hello</b>';
    }
    const instance = new CustomClass();
    const result = sanitiseEconomyData(instance);
    expect(result).toBe(instance);
    expect(result.a).toBe('<b>hello</b>');
  });

  it('should handle deeply nested arrays and objects', () => {
    const input = {
      catalog: [
        {
          id: 'gift_1',
          name: '<script>evil</script>Gift',
          meta: {
            tags: ['<b>tag1</b>', '<i>tag2</i>'],
          },
        },
      ],
    };
    const result = sanitiseEconomyData(input) as Record<string, unknown>;
    const catalog = result['catalog'] as Array<Record<string, unknown>>;
    // The mock strips tags but preserves inner text content
    expect(catalog[0]['name']).toBe('evilGift');
    const tags = (catalog[0]['meta'] as Record<string, unknown>)[
      'tags'
    ] as string[];
    expect(tags[0]).toBe('tag1');
    expect(tags[1]).toBe('tag2');
  });
});

describe('scrubReceiptToken', () => {
  it('should return null/undefined/empty string unchanged', () => {
    expect(scrubReceiptToken(null)).toBeNull();
    expect(scrubReceiptToken(undefined)).toBeUndefined();
    expect(scrubReceiptToken('')).toBe('');
  });

  it('should redact tokens shorter than 8 characters', () => {
    expect(scrubReceiptToken('abc')).toBe('[REDACTED-SHORT-TOKEN]');
    expect(scrubReceiptToken('abcdefg')).toBe('[REDACTED-SHORT-TOKEN]');
  });

  it('should preserve only the last 4 characters for tokens >= 8 chars', () => {
    expect(scrubReceiptToken('abcdefgh')).toBe('***...efgh');
    expect(scrubReceiptToken('cs_test_a1b2c3d4e5f6g7h8')).toBe('***...g7h8');
  });

  it('should handle Stripe session IDs correctly', () => {
    const token = 'cs_test_a1BcDeFgHiJkLmNoPqRsTuVwXyZ';
    const result = scrubReceiptToken(token);
    expect(result).toBe('***...wXyZ');
    expect(result!.length).toBeLessThan(token.length);
  });

  it('should handle Apple receipt data blobs', () => {
    const token = 'MIIcBAYJKoZIhvcNAQcCoIIb9TCCG...verylongbase64string';
    const result = scrubReceiptToken(token);
    expect(result).toBe('***...ring');
  });
});

describe('scrubCoinPurchaseForArchive', () => {
  it('should return null/undefined unchanged', () => {
    expect(scrubCoinPurchaseForArchive(null)).toBeNull();
    expect(scrubCoinPurchaseForArchive(undefined)).toBeUndefined();
  });

  it('should scrub receipt_token and transaction_id fields', () => {
    const record = {
      id: 'purchase-123',
      user_id: 'user-456',
      receipt_token: 'cs_test_long_session_id_abc123',
      transaction_id: 'txn_SomeLongTransactionIdXyz',
      status: 'completed',
      coins_added: 100,
    };
    const result = scrubCoinPurchaseForArchive(record);
    expect(result).not.toBeNull();
    expect(result!['id']).toBe('purchase-123');
    expect(result!['user_id']).toBe('user-456');
    expect(result!['receipt_token']).toBe('***...c123');
    expect(result!['transaction_id']).toBe('***...dXyz');
    expect(result!['status']).toBe('completed');
    expect(result!['coins_added']).toBe(100);
  });

  it('should not mutate the original record', () => {
    const record = {
      receipt_token: 'cs_test_original_token_2024',
      transaction_id: 'txn_original_12345',
    };
    scrubCoinPurchaseForArchive(record);
    expect(record.receipt_token).toBe('cs_test_original_token_2024');
    expect(record.transaction_id).toBe('txn_original_12345');
  });

  it('should handle records with null fields', () => {
    const record = {
      id: 'purchase-456',
      receipt_token: null,
      transaction_id: 'txn_ValidButShort',
    };
    const result = scrubCoinPurchaseForArchive(record);
    expect(result!['receipt_token']).toBeNull();
    expect(result!['transaction_id']).toBe('***...hort');
  });
});

describe('scrubCoinPurchasesForArchive', () => {
  it('should return null/undefined unchanged', () => {
    expect(scrubCoinPurchasesForArchive(null)).toBeNull();
    expect(scrubCoinPurchasesForArchive(undefined)).toBeUndefined();
  });

  it('should scrub an array of purchase records', () => {
    const records = [
      {
        id: 'p_1',
        receipt_token: 'cs_test_session_one_abcd',
        transaction_id: 'txn_one_efgh',
      },
      {
        id: 'p_2',
        receipt_token: 'ios_receipt_blob_two_jklm',
        transaction_id: 'txn_two_nopq',
      },
    ];
    const result = scrubCoinPurchasesForArchive(records);
    expect(Array.isArray(result)).toBe(true);
    expect(result![0]['receipt_token']).toBe('***...abcd');
    expect(result![0]['transaction_id']).toBe('***...efgh');
    expect(result![1]['receipt_token']).toBe('***...jklm');
    expect(result![1]['transaction_id']).toBe('***...nopq');
  });

  it('should not mutate original records', () => {
    const records = [
      { receipt_token: 'cs_test_original_a', transaction_id: 'txn_original_b' },
    ];
    scrubCoinPurchasesForArchive(records);
    expect(records[0].receipt_token).toBe('cs_test_original_a');
    expect(records[0].transaction_id).toBe('txn_original_b');
  });

  it('should handle non-object elements in arrays', () => {
    const records = [null, 'string', 42] as unknown[];
    const result = scrubCoinPurchasesForArchive(records);
    expect(result![0]).toBeNull();
    expect(result![1]).toBe('string');
    expect(result![2]).toBe(42);
  });
});
