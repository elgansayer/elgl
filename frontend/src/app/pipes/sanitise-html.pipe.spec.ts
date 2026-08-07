import { TestBed } from '@angular/core/testing';
import { SanitiseHtmlPipe } from './sanitise-html.pipe';
import { HtmlSanitisationService } from '../services/html-sanitisation.service';

describe('SanitiseHtmlPipe', () => {
  let pipe: SanitiseHtmlPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HtmlSanitisationService],
    });
    pipe = TestBed.runInInjectionContext(() => new SanitiseHtmlPipe());
  });

  it('should create', () => {
    expect(pipe).toBeTruthy();
  });

  it('should strip script tags', () => {
    expect(pipe.transform('<script>alert("xss")</script>')).toBe('');
  });

  it('should strip all HTML tags and return plain text', () => {
    expect(pipe.transform('<b>bold</b>')).toBe('bold');
    expect(pipe.transform('<em>italic</em>')).toBe('italic');
  });

  it('should strip tags from complex HTML', () => {
    expect(pipe.transform('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('should strip img tags with event handlers', () => {
    const result = pipe.transform('<img src=x onerror=alert(1)>');
    expect(result).not.toContain('onerror');
  });

  it('should return empty string for empty input', () => {
    expect(pipe.transform('')).toBe('');
  });

  it('should handle non-string input', () => {
    expect(pipe.transform(null as unknown as string)).toBe('');
    expect(pipe.transform(undefined as unknown as string)).toBe('');
  });

  it('should preserve plain text unchanged', () => {
    expect(pipe.transform('Hello, world!')).toBe('Hello, world!');
  });

  it('should handle dangerous XSS vectors', () => {
    expect(pipe.transform('<img src=x onerror="alert(document.cookie)">')).not.toContain('onerror');
    expect(pipe.transform('<svg onload=alert(1)>')).not.toContain('onload');
    expect(pipe.transform('<body onload=alert(1)>')).not.toContain('onload');
  });

  it('should sanitise URLs passed through', () => {
    // HTML tag stripping does not affect plain URLs
    const result = pipe.transform('https://example.com');
    expect(result).toBe('https://example.com');
  });
});