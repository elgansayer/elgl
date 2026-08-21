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

import { sanitiseFlashcardData } from './sanitise-flashcard.helper';

describe('sanitiseFlashcardData', () => {
  it('should strip HTML tags from strings', () => {
    expect(sanitiseFlashcardData('<b>bold</b>')).toBe('bold');
    expect(sanitiseFlashcardData('<script>alert("xss")</script>')).toBe(
      'alert("xss")',
    );
  });

  it('should strip javascript: protocol links', () => {
    expect(
      sanitiseFlashcardData('<a href="javascript:alert(1)">link</a>'),
    ).toBe('link');
  });

  it('should strip event handler attributes', () => {
    expect(sanitiseFlashcardData('<div onclick="steal()">click</div>')).toBe(
      'click',
    );
  });

  it('should strip img tags with onerror', () => {
    expect(sanitiseFlashcardData('<img src=x onerror="alert(1)">')).toBe('');
  });

  it('should sanitise nested objects deeply', () => {
    const input = {
      word_token: '<b>bonjour</b>',
      translation: '<script>alert(1)</script>hello',
      safe: 'greeting',
    };
    const result = sanitiseFlashcardData(input) as Record<string, unknown>;
    expect(result.word_token).toBe('bonjour');
    expect(result.translation).toBe('alert(1)hello');
    expect(result.safe).toBe('greeting');
  });

  it('should sanitise arrays of objects', () => {
    const input = [{ word_token: '<b>a</b>' }, { word_token: '<i>b</i>' }];
    const result = sanitiseFlashcardData(input) as Array<
      Record<string, unknown>
    >;
    expect(result[0].word_token).toBe('a');
    expect(result[1].word_token).toBe('b');
  });

  it('should handle null, undefined, and primitives', () => {
    expect(sanitiseFlashcardData(null)).toBeNull();
    expect(sanitiseFlashcardData(undefined)).toBeUndefined();
    expect(sanitiseFlashcardData(123)).toBe(123);
    expect(sanitiseFlashcardData(true)).toBe(true);
    expect(sanitiseFlashcardData(0)).toBe(0);
    expect(sanitiseFlashcardData('')).toBe('');
  });

  it('should not traverse class instances', () => {
    class CardMeta {
      constructor(public readonly value: string) {
        this.value = value;
      }
    }
    const instance = new CardMeta('<script>test</script>');
    const result = sanitiseFlashcardData(instance);
    expect(result).toBe(instance);
    expect(result.value).toBe('<script>test</script>');
  });

  it('should sanitise objects with empty strings and nested arrays', () => {
    const input = {
      word_token: '<div>test</div>',
      tags: ['<p>a</p>', '<span>b</span>'],
      nested: { description: '<img src=x onerror=alert(1)>safe' },
    };
    const result = sanitiseFlashcardData(input) as Record<string, unknown>;
    expect(result.word_token).toBe('test');
    expect((result.tags as string[])[0]).toBe('a');
    expect((result.tags as string[])[1]).toBe('b');
    const nested = result.nested as Record<string, unknown>;
    expect(nested.description).toBe('safe');
  });
});
