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

// Strict DOMPurify mock that strips ALL HTML tags
const { mockSanitize } = vi.hoisted(() => {
  const mockSanitize = (dirty: string): string => {
    if (typeof dirty !== 'string') return dirty;
    // Remove script/style elements and their content entirely (DOMPurify strips them)
    let result = dirty
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
    // Strip all remaining HTML tags
    result = result.replace(/<[^>]*>/g, '');
    // Decode common HTML entities
    result = result
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'");
    return result;
  };
  return { mockSanitize };
});

vi.mock('dompurify', () => {
  return {
    __esModule: true,
    default: vi.fn(() => ({
      sanitize: mockSanitize,
      setConfig: vi.fn(),
    })),
  };
});

import { sanitiseEscrowData } from './sanitise-escrow.helper';

describe('sanitiseEscrowData', () => {
  it('should strip all HTML tags from strings', () => {
    expect(sanitiseEscrowData('<b>bold</b>')).toBe('bold');
    expect(sanitiseEscrowData('<script>alert("xss")</script>')).toBe('');
    expect(sanitiseEscrowData('<img src="x" onerror="alert(1)">')).toBe('');
  });

  it('should sanitise strings in arrays', () => {
    expect(sanitiseEscrowData(['<b>test</b>', 'safe'])).toEqual([
      'test',
      'safe',
    ]);
  });

  it('should sanitise strings in plain objects', () => {
    expect(
      sanitiseEscrowData({
        id: 'escrow-1',
        reason: '<script>alert("xss")</script>',
        status: 'held',
      }),
    ).toEqual({
      id: 'escrow-1',
      reason: '',
      status: 'held',
    });
  });

  it('should recurse into nested objects', () => {
    expect(
      sanitiseEscrowData({
        metadata: { note: '<a href="javascript:alert(1)">click</a>' },
      }),
    ).toEqual({
      metadata: { note: 'click' },
    });
  });

  it('should leave numbers, booleans, null and undefined unchanged', () => {
    expect(sanitiseEscrowData(123)).toBe(123);
    expect(sanitiseEscrowData(true)).toBe(true);
    expect(sanitiseEscrowData(null)).toBe(null);
    expect(sanitiseEscrowData(undefined)).toBe(undefined);
  });

  it('should not traverse class instances', () => {
    class CustomClass {
      value = '<script>alert(1)</script>';
    }
    const instance = new CustomClass();
    const result = sanitiseEscrowData(instance);
    expect(result).toBe(instance);
    expect(result.value).toBe('<script>alert(1)</script>');
  });

  it('should not mutate Date objects', () => {
    const date = new Date('2026-01-01');
    const result = sanitiseEscrowData(date);
    expect(result).toBe(date);
  });

  it('should sanitise an EscrowTransactionResponse shape', () => {
    const response = {
      id: 'tx-001',
      payer_id: 'payer-1',
      payee_id: 'payee-1',
      amount_coins: 100,
      status: 'held' as const,
      reason: '<script>alert("xss")</script>Test payment',
      metadata: { note: '<b>important</b>' },
      held_at: '2026-01-01T00:00:00Z',
      released_at: null,
      refunded_at: null,
      cancelled_at: null,
      retry_count: 0,
      last_error: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      degraded: false,
      fallback_reason: undefined,
    };

    const result = sanitiseEscrowData(response);
    expect(result.reason).toBe('Test payment');
    expect(result.metadata).toEqual({ note: 'important' });
    expect(result.amount_coins).toBe(100);
    expect(result.status).toBe('held');
  });

  it('should sanitise EscrowHoldResult shape', () => {
    const result = sanitiseEscrowData({
      success: true,
      transaction_id: '<script>alert(1)</script>tx-123',
      degraded: false,
      fallback_reason: '<b>circuit open</b>',
    });
    expect(result.transaction_id).toBe('tx-123');
    expect(result.fallback_reason).toBe('circuit open');
  });

  it('should decode HTML entities in sanitised text', () => {
    expect(sanitiseEscrowData('Hello &lt;world&gt;')).toBe('Hello <world>');
    expect(sanitiseEscrowData('Price: &amp; sign')).toBe('Price: & sign');
  });
});
