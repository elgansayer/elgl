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

// Simple DOMPurify mock that strips dangerous HTML
const mockSanitize = (dirty: string): string => {
  if (typeof dirty !== 'string') return dirty;
  return dirty
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s+href\s*=\s*"[^"]*"/gi, (match) => {
      if (/javascript\s*:/i.test(match)) return '';
      return match;
    })
    .replace(/\s+href\s*=\s*'[^']*'/gi, (match) => {
      if (/javascript\s*:/i.test(match)) return '';
      return match;
    })
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '');
};

jest.mock('dompurify', () => {
  return {
    __esModule: true,
    default: jest.fn(() => ({
      sanitize: mockSanitize,
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

  it('should sanitize simple string', () => {
    expect(pipe.transform('<script>alert("xss")</script>', mockMetadata)).toBe(
      '',
    );
  });

  it('should sanitize array of strings', () => {
    expect(
      pipe.transform(['<script>alert("xss")</script>', 'safe'], mockMetadata),
    ).toEqual(['', 'safe']);
  });

  it('should sanitize nested objects', () => {
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
      b: { c: '<a>link</a>' },
    });
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
      username: 'user',
      password: 'my<secret>password',
      confirmPassword: 'my<secret>password',
    });
  });

  it('should skip sanitisation for stack trace fields preserving angle brackets', () => {
    const input = {
      message: '<script>alert("xss")</script>user',
      stack: 'TypeError: foo\n    at <anonymous> (app.ts:10:5)',
      componentStack: '<anonymous>\n    at AppComponent',
      stackFrames: [
        {
          functionName: '<anonymous>',
          fileName: 'app.component.ts',
          source: 'app.component.ts:42:10',
        },
      ],
      safeField: '<b>bold text</b>',
    };
    const result = pipe.transform(input, mockMetadata) as Record<string, unknown>;
    expect(result['message']).toBe('user');
    expect(result['stack']).toBe('TypeError: foo\n    at <anonymous> (app.ts:10:5)');
    expect(result['componentStack']).toBe('<anonymous>\n    at AppComponent');
    expect(result['stackFrames']).toEqual([
      {
        functionName: '<anonymous>',
        fileName: 'app.component.ts',
        source: 'app.component.ts:42:10',
      },
    ]);
    expect(result['safeField']).toBe('<b>bold text</b>');
  });

  it('should exempt rawBody and signedPayload from sanitisation', () => {
    const input = {
      message: '<script>alert("xss")</script>',
      rawBody: '{"data":"<event>payload</event>"}',
      signedPayload: '<sig>abc123</sig>',
    };
    const result = pipe.transform(input, mockMetadata) as Record<string, unknown>;
    expect(result['message']).toBe('');
    expect(result['rawBody']).toBe('{"data":"<event>payload</event>"}');
    expect(result['signedPayload']).toBe('<sig>abc123</sig>');
  });
});
