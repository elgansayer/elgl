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

// Strict DOMPurify mock that strips ALL HTML tags
const mockSanitize = (dirty: string): string => {
  if (typeof dirty !== 'string') return dirty;
  // Remove script/style elements and their content entirely (DOMPurify strips them)
  let result = dirty
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
  // Strip all remaining HTML tags
  result = result.replace(/<[^>]*>/g, '');
  // Decode common HTML entities
  result = result
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
  return result;
};

jest.mock('dompurify', () => {
  return {
    __esModule: true,
    default: jest.fn(() => ({
      sanitize: mockSanitize,
      setConfig: jest.fn(),
    })),
  };
});

import { sanitiseVideoCallsData } from './sanitise-video-calls.helper';

describe('sanitiseVideoCallsData', () => {
  it('should strip all HTML tags from strings', () => {
    expect(sanitiseVideoCallsData('<b>bold</b>')).toBe('bold');
    expect(sanitiseVideoCallsData('<script>alert("xss")</script>')).toBe('');
    expect(sanitiseVideoCallsData('<img src="x" onerror="alert(1)">')).toBe('');
  });

  it('should sanitise strings in arrays', () => {
    expect(sanitiseVideoCallsData(['<b>test</b>', 'safe'])).toEqual(['test', 'safe']);
  });

  it('should sanitise strings in plain objects', () => {
    expect(sanitiseVideoCallsData({
      roomName: '<script>alert("xss")</script>room_123',
      token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0',
    })).toEqual({
      roomName: 'room_123',
      token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0',
    });
  });

  it('should recurse into nested objects', () => {
    expect(sanitiseVideoCallsData({
      metadata: { title: '<a href="javascript:alert(1)">click</a>' },
    })).toEqual({
      metadata: { title: 'click' },
    });
  });

  it('should leave numbers, booleans, null and undefined unchanged', () => {
    expect(sanitiseVideoCallsData(123)).toBe(123);
    expect(sanitiseVideoCallsData(true)).toBe(true);
    expect(sanitiseVideoCallsData(null)).toBe(null);
    expect(sanitiseVideoCallsData(undefined)).toBe(undefined);
  });

  it('should not traverse class instances', () => {
    class CustomClass {
      value = '<script>alert(1)</script>';
    }
    const instance = new CustomClass();
    const result = sanitiseVideoCallsData(instance);
    expect(result).toBe(instance);
    expect(result.value).toBe('<script>alert(1)</script>');
  });

  it('should not mutate Date objects', () => {
    const date = new Date('2026-01-01');
    const result = sanitiseVideoCallsData(date);
    expect(result).toBe(date);
  });

  it('should sanitise a createRoom response shape', () => {
    const response = {
      token: 'eyJhbGciOiJIUzI1NiJ9.test',
      roomName: '<script>alert("xss")</script>video_abc123',
    };

    const result = sanitiseVideoCallsData(response);
    expect(result.token).toBe('eyJhbGciOiJIUzI1NiJ9.test');
    expect(result.roomName).toBe('video_abc123');
  });

  it('should sanitise a joinRoom response shape', () => {
    const result = sanitiseVideoCallsData({
      token: 'eyJhbGciOiJIUzI1NiJ9.test2',
      roomName: '<img src=x onerror="alert(1)">malicious_room',
    });
    expect(result.token).toBe('eyJhbGciOiJIUzI1NiJ9.test2');
    expect(result.roomName).toBe('malicious_room');
  });

  it('should decode HTML entities in sanitised text', () => {
    expect(sanitiseVideoCallsData('Hello &lt;world&gt;')).toBe('Hello <world>');
    expect(sanitiseVideoCallsData('Price: &amp; sign')).toBe('Price: & sign');
  });

  it('should sanitise room metadata objects deeply', () => {
    const input = {
      room_id: '<b>123</b>',
      title: '<script>alert(1)</script>My Room',
      tags: ['<p>english</p>', '<span>spanish</span>'],
      config: {
        maxParticipants: '<div>10</div>',
        description: '<img src=x onerror=alert(1)>test desc',
      },
    };
    const result = sanitiseVideoCallsData(input) as Record<string, unknown>;
    expect(result.room_id).toBe('123');
    expect(result.title).toBe('My Room');
    expect((result.tags as string[])[0]).toBe('english');
    expect((result.tags as string[])[1]).toBe('spanish');
    const config = result.config as Record<string, unknown>;
    expect(config.maxParticipants).toBe('10');
    expect(config.description).toBe('test desc');
  });
});