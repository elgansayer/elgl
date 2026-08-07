import { TestBed } from '@angular/core/testing';
import { HtmlSanitisationService } from './html-sanitisation.service';

describe('HtmlSanitisationService', () => {
  let service: HtmlSanitisationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HtmlSanitisationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('sanitiseText', () => {
    it('should strip script tags', () => {
      expect(service.sanitiseText('<script>alert("xss")</script>')).toBe('');
    });

    it('should strip all HTML tags and return plain text', () => {
      expect(service.sanitiseText('<b>bold</b>')).toBe('bold');
      expect(service.sanitiseText('<em>italic</em>')).toBe('italic');
    });

    it('should strip tags from complex HTML', () => {
      expect(service.sanitiseText('<p>Hello <b>world</b></p>')).toBe('Hello world');
    });

    it('should strip img tags with event handlers', () => {
      const result = service.sanitiseText('<img src=x onerror=alert(1)>');
      expect(result).not.toContain('onerror');
    });

    it('should return empty string for empty input', () => {
      expect(service.sanitiseText('')).toBe('');
    });

    it('should handle non-string input gracefully', () => {
      expect(service.sanitiseText(null as unknown as string)).toBe('');
      expect(service.sanitiseText(undefined as unknown as string)).toBe('');
    });

    it('should preserve plain text unchanged', () => {
      expect(service.sanitiseText('Hello, world!')).toBe('Hello, world!');
    });
  });

  describe('sanitiseUrl', () => {
    it('should reject javascript: URLs', () => {
      expect(service.sanitiseUrl('javascript:alert(1)')).toBe('');
    });

    it('should reject data: URLs', () => {
      expect(service.sanitiseUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    });

    it('should accept safe http URLs', () => {
      expect(service.sanitiseUrl('https://example.com')).toBe('https://example.com');
    });

    it('should accept safe http URLs with paths', () => {
      expect(service.sanitiseUrl('https://example.com/path?q=1')).toBe('https://example.com/path?q=1');
    });

    it('should handle non-string input gracefully', () => {
      expect(service.sanitiseUrl(null as unknown as string)).toBe('');
      expect(service.sanitiseUrl(undefined as unknown as string)).toBe('');
    });
  });
});