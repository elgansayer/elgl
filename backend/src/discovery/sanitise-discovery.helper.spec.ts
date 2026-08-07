// Mock jsdom and dompurify at module level to avoid parsing ESM dependencies
// in the Jest test environment.
const mockWindow = {
  document: {
    createElement: () => ({}),
    createTextNode: (text: string) => ({ textContent: text }),
    body: { appendChild: () => {} },
  },
  Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
  NodeFilter: { SHOW_ELEMENT: 1 },
};

jest.mock('jsdom', () => ({
  JSDOM: jest.fn().mockImplementation(() => ({
    window: mockWindow,
  })),
}));

// Strict DOMPurify mock that strips ALL HTML tags
const mockSanitize = (input: string): string => {
  // Remove script/style elements and their content entirely (DOMPurify strips them)
  const withoutScripts = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  // Strip all remaining HTML tags
  return withoutScripts.replace(/<[^>]*>/g, '');
};

const mockPurifyInstance = {
  setConfig: jest.fn(),
  sanitize: jest.fn().mockImplementation(mockSanitize),
};

const mockCreateDOMPurify = jest.fn(() => mockPurifyInstance);

jest.mock('dompurify', () => mockCreateDOMPurify);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sanitiseDiscoveryData } = require('./sanitise-discovery.helper');

describe('sanitiseDiscoveryData', () => {
  it('strips HTML tags from strings', () => {
    expect(sanitiseDiscoveryData('<b>bold</b>')).toBe('bold');
    expect(sanitiseDiscoveryData('<script>alert("xss")</script>')).toBe('');
    expect(sanitiseDiscoveryData('<img src="x" onerror="alert(1)">')).toBe('');
  });

  it('deeply sanitises arrays', () => {
    expect(sanitiseDiscoveryData(['<b>test</b>', 'safe'])).toEqual([
      'test',
      'safe',
    ]);
  });

  it('deeply sanitises nested objects', () => {
    expect(
      sanitiseDiscoveryData({
        display_name: '<script>evil</script>Jane',
        bio_text: '<b>Hello</b> world',
        interests: ['<img>coding', 'music'],
      }),
    ).toEqual({
      display_name: 'Jane',
      bio_text: 'Hello world',
      interests: ['coding', 'music'],
    });
  });

  it('returns primitives unchanged', () => {
    expect(sanitiseDiscoveryData(123)).toBe(123);
    expect(sanitiseDiscoveryData(true)).toBe(true);
    expect(sanitiseDiscoveryData(null)).toBe(null);
    expect(sanitiseDiscoveryData(undefined)).toBe(undefined);
  });

  it('does not traverse class instances', () => {
    const date = new Date('2024-01-01');
    const result = sanitiseDiscoveryData(date);
    expect(result).toBe(date);
  });

  it('handles mixed arrays with objects', () => {
    const input = [
      { display_name: '<b>Alice</b>', bio_text: 'Hello' },
      { display_name: '<script>x</script>Bob', bio_text: '<p>World</p>' },
    ];
    expect(sanitiseDiscoveryData(input)).toEqual([
      { display_name: 'Alice', bio_text: 'Hello' },
      { display_name: 'Bob', bio_text: 'World' },
    ]);
  });
});
