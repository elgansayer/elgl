import { ArgumentMetadata } from '@nestjs/common';

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

// Simple DOMPurify mock that strips ALL HTML tags (strict sanitisation)
// In strict mode with ALLOWED_TAGS = [], KEEP_CONTENT = true:
// - All HTML tags are stripped
// - Text content of standard elements is preserved
// - Script and style elements have their content removed entirely for security
const mockSanitize = (dirty: string): string => {
  if (typeof dirty !== 'string') return dirty;
  // First remove script and style elements entirely (with their content)
  let result = dirty
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  // Then strip all remaining HTML tags, preserving text content
  result = result.replace(/<[^>]*>/g, '');
  return result;
};

jest.mock('dompurify', () => {
  return {
    __esModule: true,
    default: jest.fn(() => ({
      sanitize: (dirty: string, _config?: Record<string, unknown>) =>
        mockSanitize(dirty),
    })),
  };
});

import { SanitiseHtmlPipe } from './sanitise-html.pipe';

describe('SanitiseHtmlPipe', () => {
  let pipe: SanitiseHtmlPipe;
  const mockMetadata: ArgumentMetadata = { type: 'body' };

  beforeEach(() => {
    pipe = new SanitiseHtmlPipe();
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should sanitize simple string (strip all HTML, preserve text)', () => {
    expect(pipe.transform('<script>alert("xss")</script>', mockMetadata)).toBe(
      '',
    );
  });

  it('should sanitize array of strings', () => {
    expect(
      pipe.transform(['<script>alert("xss")</script>', 'safe'], mockMetadata),
    ).toEqual(['', 'safe']);
  });

  it('should sanitize nested objects (strip all tags, preserve text)', () => {
    expect(
      pipe.transform(
        {
          a: '<script>alert("xss")</script>',
          b: { c: '<a href="javascript:alert(1)">link</a>' },
        },
        mockMetadata,
      ),
    ).toEqual({
      a: '',
      b: { c: 'link' },
    });
  });

  it('should strip benign HTML tags as well (strict mode)', () => {
    expect(
      pipe.transform('<b>bold</b> and <i>italic</i>', mockMetadata),
    ).toBe('bold and italic');
    expect(
      pipe.transform('<p>paragraph</p> with <br> line breaks', mockMetadata),
    ).toBe('paragraph with  line breaks');
  });

  it('should strip all attributes from any tags', () => {
    expect(
      pipe.transform('<span class="test" data-x="y">text</span>', mockMetadata),
    ).toBe('text');
    expect(
      pipe.transform('<img src="x" onerror="alert(1)">', mockMetadata),
    ).toBe('');
  });

  it('should ignore numbers, null, and undefined', () => {
    expect(pipe.transform(123, mockMetadata)).toBe(123);
    expect(pipe.transform(null, mockMetadata)).toBe(null);
    expect(pipe.transform(undefined, mockMetadata)).toBe(undefined);
  });

  it('should not mutate class instances', () => {
    class CustomClass {
      a = '<script>alert(1)</script>';
    }
    const instance = new CustomClass();
    const result = pipe.transform(instance, mockMetadata);
    expect(result).toBe(instance);
    expect((result as CustomClass).a).toBe('<script>alert(1)</script>');
  });

  it('should not mutate Buffer objects', () => {
    const buffer = Buffer.from('hello');
    const result = pipe.transform(buffer, mockMetadata);
    expect(result).toBe(buffer);
  });

  it('should skip sanitisation for passwords', () => {
    const input = {
      username: '<script>alert("xss")</script>user',
      password: 'my<secret>password',
      confirmPassword: 'my<secret>password',
    };
    const result = pipe.transform(input, mockMetadata);
    expect(result).toEqual({
      // Strict: script tag and its content are fully removed
      username: 'user',
      password: 'my<secret>password',
      confirmPassword: 'my<secret>password',
    });
  });

  it('should strip complex nested HTML preserving inner text', () => {
    expect(
      pipe.transform(
        '<div><p>Hello <b>world</b></p><script>evil()</script></div>',
        mockMetadata,
      ),
    ).toBe('Hello world');
  });
});
