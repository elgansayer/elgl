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

import { sanitiseEconomyData } from './sanitise-economy.helper';

describe('sanitiseEconomyData', () => {
  it('should strip all HTML tags from strings', () => {
    expect(sanitiseEconomyData('<b>bold</b>')).toBe('bold');
    expect(sanitiseEconomyData('<script>alert("xss")</script>')).toBe(
      'alert("xss")',
    );
    expect(
      sanitiseEconomyData('<a href="javascript:alert(1)">link</a>'),
    ).toBe('link');
  });

  it('should strip event handler attributes', () => {
    expect(sanitiseEconomyData('<div onclick="steal()">click</div>')).toBe(
      'click',
    );
    expect(
      sanitiseEconomyData('<img src=x onerror="alert(1)">'),
    ).toBe('');
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
    expect((result as CustomClass).a).toBe('<b>hello</b>');
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