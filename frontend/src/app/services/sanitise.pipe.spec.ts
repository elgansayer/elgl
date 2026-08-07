import { TestBed } from '@angular/core/testing';
import { SanitisePipe } from './sanitise.pipe';
import { HtmlSanitisationService } from './html-sanitisation.service';

describe('SanitisePipe', () => {
  let pipe: SanitisePipe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HtmlSanitisationService],
    });
    pipe = TestBed.runInInjectionContext(() => new SanitisePipe());
  });

  it('should strip script tags', () => {
    expect(pipe.transform('<script>alert("xss")</script>')).toBe('');
  });

  it('should strip HTML tags and return plain text', () => {
    expect(pipe.transform('<b>bold</b>')).toBe('bold');
    expect(pipe.transform('<em>italic</em>')).toBe('italic');
    expect(pipe.transform('<a href="https://evil.com">click</a>')).toBe('click');
  });

  it('should strip complex nested HTML', () => {
    expect(pipe.transform('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('should strip img tags with event handlers', () => {
    const result = pipe.transform('<img src=x onerror=alert(1)>');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('<img');
  });

  it('should return empty string for empty input', () => {
    expect(pipe.transform('')).toBe('');
  });

  it('should handle null and undefined gracefully', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });

  it('should preserve plain text unchanged', () => {
    expect(pipe.transform('Hello, world!')).toBe('Hello, world!');
  });

  it('should strip SVG tags', () => {
    expect(pipe.transform('<svg onload=alert(1)>')).toBe('');
  });

  it('should strip event handler attributes', () => {
    expect(pipe.transform('<div onclick="steal()">content</div>')).toBe('content');
  });

  it('should strip style tags with XSS', () => {
    expect(pipe.transform('<style>body{color:red}</style>')).toBe('');
  });
});