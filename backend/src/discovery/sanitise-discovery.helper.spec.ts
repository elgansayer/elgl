// Mock jsdom and dompurify at module level to avoid parsing ESM dependencies
vi.mock('jsdom', () => ({
  JSDOM: vi.fn().mockImplementation(function () {
    return {
      window: {
        document: {
          createElement: vi.fn().mockReturnValue({}),
          createTextNode: vi.fn().mockReturnValue({}),
        },
        Node: {
          TEXT_NODE: 3,
        },
      },
    };
  }),
}));

// Strict DOMPurify mock that strips ALL HTML tags
const { mockSanitize } = vi.hoisted(() => {
  const mockSanitize = (dirty: string): string => {
    if (typeof dirty !== 'string') return '';
    return dirty.replace(/<[^>]*>/g, '');
  };
  return { mockSanitize };
});

vi.mock('dompurify', () => {
  return {
    __esModule: true,
    default: vi.fn().mockImplementation(() => ({
      sanitize: mockSanitize,
      setConfig: vi.fn(),
    })),
  };
});

import { sanitiseDiscoveryData } from './sanitise-discovery.helper';

describe('sanitiseDiscoveryData', () => {
  it('should strip script tags from strings', () => {
    expect(sanitiseDiscoveryData('<script>alert("xss")</script>')).toBe(
      'alert("xss")',
    );
  });

  it('should strip all HTML tags and return plain text', () => {
    expect(sanitiseDiscoveryData('<b>bold</b>')).toBe('bold');
    expect(sanitiseDiscoveryData('<em>italic</em>')).toBe('italic');
  });

  it('should strip tags from complex HTML', () => {
    expect(sanitiseDiscoveryData('<p>Hello <b>world</b></p>')).toBe(
      'Hello world',
    );
  });

  it('should preserve plain text unchanged', () => {
    expect(sanitiseDiscoveryData('Hello, world!')).toBe('Hello, world!');
  });

  it('should strip img tags with onerror handlers', () => {
    const result = sanitiseDiscoveryData('<img src=x onerror=alert(1)>');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('<img');
  });

  it('should sanitise deeply nested objects', () => {
    const input = {
      id: 'abc-123',
      display_name: '<script>evil()</script>Tanaka',
      bio_text: '<img src=x onerror=alert(1)>',
      native_languages: ['<b>JA</b>', 'EN'],
      nested: {
        value: '<p>test</p>',
      },
    };

    const result = sanitiseDiscoveryData(input);

    expect(result.display_name).toBe('evil()Tanaka');
    expect(result.bio_text).toBe('');
    expect(result.native_languages).toEqual(['JA', 'EN']);
    expect(result.nested.value).toBe('test');
  });

  it('should sanitise arrays of objects', () => {
    const input = [
      { display_name: '<b>User1</b>' },
      { display_name: '<i>User2</i>' },
    ];

    const result = sanitiseDiscoveryData(input);

    expect(result[0].display_name).toBe('User1');
    expect(result[1].display_name).toBe('User2');
  });

  it('should return primitives unchanged', () => {
    expect(sanitiseDiscoveryData(42)).toBe(42);
    expect(sanitiseDiscoveryData(true)).toBe(true);
    expect(sanitiseDiscoveryData(null)).toBeNull();
    expect(sanitiseDiscoveryData(undefined)).toBeUndefined();
  });

  it('should return empty string for empty input', () => {
    expect(sanitiseDiscoveryData('')).toBe('');
  });

  it('should not traverse class instances', () => {
    const date = new Date();
    const result = sanitiseDiscoveryData(date);
    expect(result).toBe(date);
  });
});
