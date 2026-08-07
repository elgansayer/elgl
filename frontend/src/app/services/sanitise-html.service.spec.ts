import { TestBed } from '@angular/core/testing';
import { SanitiseHtmlService } from './sanitise-html.service';

describe('SanitiseHtmlService', () => {
  let service: SanitiseHtmlService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SanitiseHtmlService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should strip script tags entirely including their content', () => {
    const result = service.sanitise('<script>alert("xss")</script>');
    // DOMPurify strips script elements and their content for security
    expect(result).toBe('');
  });

  it('should strip all HTML tags (strict mode)', () => {
    expect(service.sanitise('<b>bold</b> and <i>italic</i>')).toBe(
      'bold and italic',
    );
  });

  it('should strip images and event handlers', () => {
    const result = service.sanitise(
      '<img src=x onerror="alert(1)"><span onclick="evil()">text</span>',
    );
    // All tags removed, text content preserved
    expect(result).toBe('text');
  });

  it('should handle plain text unchanged', () => {
    expect(service.sanitise('hello world')).toBe('hello world');
  });

  it('should handle empty string', () => {
    expect(service.sanitise('')).toBe('');
  });

  it('should strip deeply nested HTML preserving inner text', () => {
    const result = service.sanitise(
      '<div><p>Hello <b>world</b></p><script>evil()</script></div>',
    );
    // Script element and its content are fully removed
    expect(result).toBe('Hello world');
  });

  it('should sanitise an object recursively', () => {
    const input = {
      name: '<b>John</b>',
      bio: '<script>alert(1)</script>hello',
      age: 30,
      nested: {
        description: '<p>text</p>',
      },
    };
    const result = service.sanitiseObject(input);
    expect(result).toEqual({
      name: 'John',
      // DOMPurify strips script/style content entirely for security
      bio: 'hello',
      age: 30,
      nested: {
        description: 'text',
      },
    });
  });

  it('should skip password fields when sanitising objects', () => {
    const input = {
      username: '<b>user</b>',
      password: 'my<secret>pass',
    };
    const result = service.sanitiseObject(input);
    expect(result).toEqual({
      username: 'user',
      password: 'my<secret>pass',
    });
  });
});