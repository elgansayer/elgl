import { ArgumentMetadata } from '@nestjs/common';

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

const { mockSanitize } = vi.hoisted(() => {
  const mockSanitize = (dirty: string): string => {
    let result = dirty
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
    result = result.replace(/<[^>]*>/g, '');
    return result
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'");
  };
  return { mockSanitize };
});

vi.mock('dompurify', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    sanitize: mockSanitize,
  })),
}));

import { SanitiseHtmlPipe } from './sanitise-html.pipe';

describe('SanitiseHtmlPipe', () => {
  let pipe: SanitiseHtmlPipe;
  const mockMetadata: ArgumentMetadata = { type: 'body' };

  beforeEach(() => {
    pipe = new SanitiseHtmlPipe();
  });

  it('strips all markup from a directly supplied legacy string', () => {
    expect(pipe.transform('<b>bold</b>', mockMetadata)).toBe('bold');
    expect(
      pipe.transform('<img src="x" onerror="alert(1)">', mockMetadata),
    ).toBe('');
    expect(pipe.transform('<script>alert("xss")</script>', mockMetadata)).toBe(
      '',
    );
  });

  it('preserves ordinary plain text', () => {
    expect(pipe.transform('Hello, 世界!', mockMetadata)).toBe('Hello, 世界!');
  });

  it('does not recursively mutate arrays', () => {
    const input = ['<b>literal</b>', 'safe'];

    expect(pipe.transform(input, mockMetadata)).toBe(input);
    expect(input).toEqual(['<b>literal</b>', 'safe']);
  });

  it('does not recursively mutate request DTO objects', () => {
    const input = {
      bio: 'I use <T> in TypeScript examples',
      password: 'my<secret>password',
      nested: { message: '<b>literal markup</b>' },
    };

    expect(pipe.transform(input, mockMetadata)).toBe(input);
    expect(input).toEqual({
      bio: 'I use <T> in TypeScript examples',
      password: 'my<secret>password',
      nested: { message: '<b>literal markup</b>' },
    });
  });

  it('leaves non-string values untouched', () => {
    expect(pipe.transform(123, mockMetadata)).toBe(123);
    expect(pipe.transform(null, mockMetadata)).toBe(null);
    expect(pipe.transform(undefined, mockMetadata)).toBe(undefined);

    const buffer = Buffer.from('hello');
    expect(pipe.transform(buffer, mockMetadata)).toBe(buffer);
  });
});
