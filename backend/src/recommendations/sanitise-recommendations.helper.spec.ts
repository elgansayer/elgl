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

import { sanitiseRecommendationsData } from './sanitise-recommendations.helper';

describe('sanitiseRecommendationsData', () => {
  it('should strip HTML tags from strings', () => {
    expect(sanitiseRecommendationsData('<b>bold</b>')).toBe('bold');
    expect(sanitiseRecommendationsData('<script>alert("xss")</script>')).toBe(
      'alert("xss")',
    );
  });

  it('should strip javascript: protocol links', () => {
    expect(
      sanitiseRecommendationsData('<a href="javascript:alert(1)">link</a>'),
    ).toBe('link');
  });

  it('should strip event handler attributes', () => {
    expect(
      sanitiseRecommendationsData('<div onclick="steal()">click</div>'),
    ).toBe('click');
  });

  it('should strip img tags with onerror', () => {
    expect(sanitiseRecommendationsData('<img src=x onerror="alert(1)">')).toBe(
      '',
    );
  });

  it('should sanitise a RecommendedUserDto shape', () => {
    const input = {
      id: '<script>alert(1)</script>user-1',
      displayName: '<b>Alice</b>',
      avatarUrl: '<img src=x onerror=alert(1)>http://img/1.png',
      nativeLanguage: '<div>es</div>',
      targetLanguages: ['<span>en</span>', '<b>fr</b>'],
      sharedInterests: 3,
      isSeriousLearner: true,
      studyStreakDays: 15,
      correctionRatio: 0.9,
      matchTier: 'language_exchange',
    };
    const result = sanitiseRecommendationsData(input) as Record<
      string,
      unknown
    >;
    expect(result.id).toBe('alert(1)user-1');
    expect(result.displayName).toBe('Alice');
    expect(result.avatarUrl).toBe('http://img/1.png');
    expect(result.nativeLanguage).toBe('es');
    expect((result.targetLanguages as string[])[0]).toBe('en');
    expect((result.targetLanguages as string[])[1]).toBe('fr');
    expect(result.sharedInterests).toBe(3);
    expect(result.isSeriousLearner).toBe(true);
  });

  it('should sanitise arrays of RecommendedUserDto', () => {
    const input = [
      { id: 'u-1', displayName: '<b>Alice</b>', sharedInterests: 3 },
      {
        id: 'u-2',
        displayName: '<script>alert(1)</script>Bob',
        sharedInterests: 1,
      },
    ];
    const result = sanitiseRecommendationsData(input) as Array<
      Record<string, unknown>
    >;
    expect(result[0].displayName).toBe('Alice');
    expect(result[1].displayName).toBe('alert(1)Bob');
  });

  it('should handle null, undefined, and primitives', () => {
    expect(sanitiseRecommendationsData(null)).toBeNull();
    expect(sanitiseRecommendationsData(undefined)).toBeUndefined();
    expect(sanitiseRecommendationsData(123)).toBe(123);
    expect(sanitiseRecommendationsData(true)).toBe(true);
    expect(sanitiseRecommendationsData(0)).toBe(0);
    expect(sanitiseRecommendationsData('')).toBe('');
  });

  it('should not traverse class instances', () => {
    class CustomDto {
      constructor(public readonly value: string) {
        this.value = value;
      }
    }
    const instance = new CustomDto('<script>test</script>');
    const result = sanitiseRecommendationsData(instance);
    expect(result).toBe(instance);
    expect(result.value).toBe('<script>test</script>');
  });

  it('should sanitise nested objects deeply', () => {
    const input = {
      meta: { note: '<a href="javascript:alert(1)">click</a>' },
      extra: { tags: ['<p>safe</p>', '<img src=x onerror=alert(1)>danger'] },
    };
    const result = sanitiseRecommendationsData(input) as Record<
      string,
      unknown
    >;
    const meta = result.meta as Record<string, unknown>;
    expect(meta.note).toBe('click');
    const extra = result.extra as Record<string, unknown>;
    const tags = extra.tags as string[];
    expect(tags[0]).toBe('safe');
    expect(tags[1]).toBe('danger');
  });
});
