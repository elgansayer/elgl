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

import { sanitiseShoppingData } from './sanitise-shopping.helper';

describe('sanitiseShoppingData', () => {
  it('should strip all HTML tags from strings', () => {
    expect(sanitiseShoppingData('<b>bold</b>')).toBe('bold');
    expect(sanitiseShoppingData('<script>alert("xss")</script>')).toBe(
      'alert("xss")',
    );
    expect(sanitiseShoppingData('<a href="javascript:alert(1)">link</a>')).toBe(
      'link',
    );
  });

  it('should strip event handler attributes', () => {
    expect(sanitiseShoppingData('<div onclick="steal()">click</div>')).toBe(
      'click',
    );
    expect(sanitiseShoppingData('<img src=x onerror="alert(1)">')).toBe('');
  });

  it('should sanitise nested objects deeply', () => {
    const input = {
      name: '<b>Red Rose</b>',
      description: '<p>A <em>classic</em> virtual rose</p>',
      imageUrl: 'https://r2.example.com/rose.png',
      id: 'rose',
    };
    const result = sanitiseShoppingData(input) as Record<string, unknown>;
    expect(result['name']).toBe('Red Rose');
    expect(result['description']).toBe('A classic virtual rose');
    expect(result['imageUrl']).toBe('https://r2.example.com/rose.png');
  });

  it('should sanitise catalog arrays', () => {
    const input = [
      { id: 'rose', name: '<b>Rose</b>', price: 10 },
      { id: 'coffee', name: '<i>Coffee</i>', price: 15 },
    ];
    const result = sanitiseShoppingData(input) as Array<
      Record<string, unknown>
    >;
    expect(result[0]['name']).toBe('Rose');
    expect(result[0]['price']).toBe(10);
    expect(result[1]['name']).toBe('Coffee');
    expect(result[1]['price']).toBe(15);
  });

  it('should sanitise cart items', () => {
    const input = {
      items: [
        {
          itemId: 'rose',
          name: '<span>Red Rose</span>',
          quantity: 2,
          unitPrice: 10,
        },
      ],
    };
    const result = sanitiseShoppingData(input) as Record<string, unknown>;
    const items = result['items'] as Array<Record<string, unknown>>;
    expect(items[0]['name']).toBe('Red Rose');
    expect(items[0]['quantity']).toBe(2);
    expect(items[0]['unitPrice']).toBe(10);
  });

  it('should return primitives unchanged', () => {
    expect(sanitiseShoppingData(null)).toBeNull();
    expect(sanitiseShoppingData(undefined)).toBeUndefined();
    expect(sanitiseShoppingData(123)).toBe(123);
    expect(sanitiseShoppingData(true)).toBe(true);
    expect(sanitiseShoppingData(0)).toBe(0);
    expect(sanitiseShoppingData('')).toBe('');
  });

  it('should not traverse class instances', () => {
    class CustomClass {
      a = '<b>hello</b>';
    }
    const instance = new CustomClass();
    const result = sanitiseShoppingData(instance);
    expect(result).toBe(instance);
    expect(result.a).toBe('<b>hello</b>');
  });

  it('should handle checkout response with message', () => {
    const input = {
      success: true,
      message: 'Checkout <b>completed</b> successfully.',
    };
    const result = sanitiseShoppingData(input) as Record<string, unknown>;
    expect(result['success']).toBe(true);
    expect(result['message']).toBe('Checkout completed successfully.');
  });
});
