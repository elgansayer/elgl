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

import { sanitiseReadingEngineData } from './sanitise-reading-engine.helper';

describe('sanitiseReadingEngineData', () => {
  it('should strip HTML tags from strings', () => {
    expect(sanitiseReadingEngineData('<b>bold</b>')).toBe('bold');
    expect(sanitiseReadingEngineData('<script>alert("xss")</script>')).toBe(
      'alert("xss")',
    );
  });

  it('should strip javascript: protocol links', () => {
    expect(
      sanitiseReadingEngineData('<a href="javascript:alert(1)">link</a>'),
    ).toBe('link');
  });

  it('should strip event handler attributes', () => {
    expect(
      sanitiseReadingEngineData('<div onclick="steal()">click</div>'),
    ).toBe('click');
  });

  it('should strip img tags with onerror', () => {
    expect(sanitiseReadingEngineData('<img src=x onerror="alert(1)">')).toBe(
      '',
    );
  });

  it('should sanitise nested objects deeply', () => {
    const input = {
      title: '<b>La Vie Parisienne</b>',
      content: '<script>alert(1)</script>Bonjour le monde',
      language: 'fr',
    };
    const result = sanitiseReadingEngineData(input) as Record<string, unknown>;
    expect(result.title).toBe('La Vie Parisienne');
    expect(result.content).toBe('alert(1)Bonjour le monde');
    expect(result.language).toBe('fr');
  });

  it('should sanitise arrays of objects', () => {
    const input = [
      { title: '<b>Article A</b>' },
      { title: '<i>Article B</i>' },
    ];
    const result = sanitiseReadingEngineData(input) as Array<
      Record<string, unknown>
    >;
    expect(result[0].title).toBe('Article A');
    expect(result[1].title).toBe('Article B');
  });

  it('should handle null, undefined, and primitives', () => {
    expect(sanitiseReadingEngineData(null)).toBeNull();
    expect(sanitiseReadingEngineData(undefined)).toBeUndefined();
    expect(sanitiseReadingEngineData(123)).toBe(123);
    expect(sanitiseReadingEngineData(true)).toBe(true);
    expect(sanitiseReadingEngineData(0)).toBe(0);
    expect(sanitiseReadingEngineData('')).toBe('');
  });

  it('should not traverse class instances', () => {
    class ResourceMeta {
      constructor(public readonly value: string) {
        this.value = value;
      }
    }
    const instance = new ResourceMeta('<script>test</script>');
    const result = sanitiseReadingEngineData(instance);
    expect(result).toBe(instance);
    expect(result.value).toBe('<script>test</script>');
  });

  it('should sanitise objects with empty strings and nested arrays', () => {
    const input = {
      title: '<div>Hello</div>',
      tags: ['<p>a</p>', '<span>b</span>'],
      nested: { content: '<img src=x onerror=alert(1)>safe' },
    };
    const result = sanitiseReadingEngineData(input) as Record<string, unknown>;
    expect(result.title).toBe('Hello');
    expect((result.tags as string[])[0]).toBe('a');
    expect((result.tags as string[])[1]).toBe('b');
    const nested = result.nested as Record<string, unknown>;
    expect(nested.content).toBe('safe');
  });
});
