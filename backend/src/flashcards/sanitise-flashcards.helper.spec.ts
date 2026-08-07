// Mock jsdom and dompurify at module level to avoid parsing ESM dependencies
jest.mock('jsdom', () => ({
  JSDOM: jest.fn().mockImplementation((_html: string) => ({
    window: {
      document: {
        createElement: jest.fn(),
        createDocumentFragment: jest.fn(),
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
  })),
}));

// Strict mock: strip ALL HTML tags (mirrors the empty ALLOWED_TAGS config)
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

const mockSetConfig = jest.fn();

jest.mock('dompurify', () => {
  return {
    __esModule: true,
    default: jest.fn(() => ({
      sanitize: mockStrictSanitize,
      setConfig: mockSetConfig,
    })),
  };
});

import { sanitiseFlashcardsData } from './sanitise-flashcards.helper';

describe('sanitiseFlashcardsData', () => {
  it('should strip all HTML tags from strings', () => {
    expect(sanitiseFlashcardsData('<b>bonjour</b>')).toBe('bonjour');
    expect(sanitiseFlashcardsData('<script>alert("xss")</script>')).toBe(
      'alert("xss")',
    );
    expect(
      sanitiseFlashcardsData('<a href="javascript:alert(1)">link</a>'),
    ).toBe('link');
  });

  it('should strip event handler attributes', () => {
    expect(sanitiseFlashcardsData('<div onclick="steal()">click</div>')).toBe(
      'click',
    );
    expect(
      sanitiseFlashcardsData('<img src=x onerror="alert(1)">'),
    ).toBe('');
  });

  it('should sanitise nested objects deeply', () => {
    const input = {
      word_token: '<b>Hola</b>',
      original_context: '<p>Hola <em>mundo</em></p>',
      translation: '<span>Hello</span>',
      definition: '<div>A <strong>greeting</strong></div>',
      pronunciation_url: 'https://r2.example.com/audio.mp3',
    };
    const result = sanitiseFlashcardsData(input) as Record<string, unknown>;
    expect(result['word_token']).toBe('Hola');
    expect(result['original_context']).toBe('Hola mundo');
    expect(result['translation']).toBe('Hello');
    expect(result['definition']).toBe('A greeting');
    expect(result['pronunciation_url']).toBe('https://r2.example.com/audio.mp3');
  });

  it('should sanitise arrays of objects', () => {
    const input = [
      { word_token: '<b>Rose</b>', translation: '<i>Rosa</i>' },
      { word_token: '<b>Heart</b>', translation: '<i>Corazón</i>' },
    ];
    const result = sanitiseFlashcardsData(input) as Array<Record<string, unknown>>;
    expect(result[0]['word_token']).toBe('Rose');
    expect(result[0]['translation']).toBe('Rosa');
    expect(result[1]['word_token']).toBe('Heart');
    expect(result[1]['translation']).toBe('Corazón');
  });

  it('should return primitives unchanged', () => {
    expect(sanitiseFlashcardsData(null)).toBeNull();
    expect(sanitiseFlashcardsData(undefined)).toBeUndefined();
    expect(sanitiseFlashcardsData(123)).toBe(123);
    expect(sanitiseFlashcardsData(true)).toBe(true);
    expect(sanitiseFlashcardsData(0)).toBe(0);
    expect(sanitiseFlashcardsData('')).toBe('');
  });

  it('should not traverse class instances', () => {
    class CustomClass {
      a = '<b>hello</b>';
    }
    const instance = new CustomClass();
    const result = sanitiseFlashcardsData(instance);
    expect(result).toBe(instance);
    expect((result as CustomClass).a).toBe('<b>hello</b>');
  });

  it('should handle deeply nested arrays and objects', () => {
    const input = {
      cards: [
        {
          id: 'card_1',
          word_token: '<script>evil</script>Word',
          meta: {
            tags: ['<b>noun</b>', '<i>verb</i>'],
          },
        },
      ],
    };
    const result = sanitiseFlashcardsData(input) as Record<string, unknown>;
    const cards = result['cards'] as Array<Record<string, unknown>>;
    expect(cards[0]['word_token']).toBe('evilWord');
    const tags = (cards[0]['meta'] as Record<string, unknown>)[
      'tags'
    ] as string[];
    expect(tags[0]).toBe('noun');
    expect(tags[1]).toBe('verb');
  });

  it('should sanitise Flashcard response shape correctly', () => {
    const card = {
      id: 'abc-123',
      user_id: 'user-1',
      word_token: '<b>Guten</b>',
      original_context: '<p>Guten <em>Tag</em></p>',
      translation: '<span>Good day</span>',
      definition: '<div>A <strong>German greeting</strong></div>',
      pronunciation_url: 'https://r2.example.com/guten.mp3',
      srs_level: 2,
      easiness_factor: 2.5,
      repetitions: 3,
      interval_days: 15,
      next_review_at: '2026-07-23T12:00:00.000Z',
      created_at: '2026-07-01T12:00:00.000Z',
    };
    const result = sanitiseFlashcardsData(card) as Record<string, unknown>;
    expect(result['word_token']).toBe('Guten');
    expect(result['original_context']).toBe('Guten Tag');
    expect(result['translation']).toBe('Good day');
    expect(result['definition']).toBe('A German greeting');
    expect(result['srs_level']).toBe(2);
    expect(result['easiness_factor']).toBe(2.5);
    expect(result['repetitions']).toBe(3);
    expect(result['interval_days']).toBe(15);
  });

  it('should sanitise suggestions response shape correctly', () => {
    const suggestions = {
      suggestions: [
        '<b>hello</b>',
        '<i>world</i>',
        '<script>alert("xss")</script>',
      ],
    };
    const result = sanitiseFlashcardsData(suggestions) as Record<string, unknown>;
    const resultSuggestions = result['suggestions'] as string[];
    expect(resultSuggestions).toEqual(['hello', 'world', 'alert("xss")']);
  });
});