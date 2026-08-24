import { TestBed } from '@angular/core/testing';
import { afterEach, vi } from 'vitest';
import { FontScaleService } from './font-scale.service';

describe('FontScaleService', () => {
  let service: FontScaleService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.fontSize = '';
    document.documentElement.style.removeProperty('--app-base-font-size');
    document.documentElement.style.removeProperty('--chat-message-font-size');
    TestBed.configureTestingModule({});
    service = TestBed.inject(FontScaleService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should default to a scale factor of 1.0', () => {
    expect(service.scaleFactor()).toBe(1.0);
    expect(service.textSizePreference()).toBe('normal');
  });

  it('should expose the documented 80-150 percent range', () => {
    expect(service.min).toBe(0.8);
    expect(service.max).toBe(1.5);
    expect(service.step).toBe(0.05);
  });

  it('should restore a previously saved percentage from localStorage', () => {
    localStorage.setItem('app_font_scale', '150');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const freshService = TestBed.inject(FontScaleService);
    expect(freshService.scaleFactor()).toBe(1.5);
  });

  it('should continue to accept legacy fractional storage values', () => {
    localStorage.setItem('app_font_scale', '1.35');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const freshService = TestBed.inject(FontScaleService);
    expect(freshService.scaleFactor()).toBe(1.35);
  });

  it('should ignore an out-of-range saved value and fall back to the default', () => {
    localStorage.setItem('app_font_scale', '151');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const freshService = TestBed.inject(FontScaleService);
    expect(freshService.scaleFactor()).toBe(1.0);
  });

  it('should fall back to the default when storage reads are blocked', () => {
    TestBed.resetTestingModule();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    TestBed.configureTestingModule({});

    const freshService = TestBed.inject(FontScaleService);

    expect(freshService.scaleFactor()).toBe(1.0);
    expect(freshService.chatTextSize()).toBe('medium');
  });

  it('should update the scale factor when setScale is called', () => {
    service.setScale(1.5);
    expect(service.scaleFactor()).toBe(1.5);
  });

  it('should clamp values to the documented range and snap to the configured step', () => {
    service.setScale(2);
    expect(service.scaleFactor()).toBe(1.5);

    service.setScale(0.1);
    expect(service.scaleFactor()).toBe(0.8);

    service.setScale(1.33);
    expect(service.scaleFactor()).toBe(1.35);
  });

  it('should ignore non-finite scale values', () => {
    service.setScale(Number.NaN);
    expect(service.scaleFactor()).toBe(1.0);

    service.setScale(Number.POSITIVE_INFINITY);
    expect(service.scaleFactor()).toBe(1.0);
  });

  it('should map the small, normal and large appearance choices to safe app scales', () => {
    service.setTextSizePreference('small');
    expect(service.scaleFactor()).toBe(0.9);
    expect(service.textSizePreference()).toBe('small');

    service.setTextSizePreference('normal');
    expect(service.scaleFactor()).toBe(1);
    expect(service.textSizePreference()).toBe('normal');

    service.setTextSizePreference('large');
    expect(service.scaleFactor()).toBeCloseTo(1.15);
    expect(service.textSizePreference()).toBe('large');
  });

  it('should apply 150 percent as a 24px root font size', () => {
    service.setScale(1.5);
    TestBed.flushEffects();
    expect(document.documentElement.style.fontSize).toBe('24px');
    expect(document.documentElement.style.getPropertyValue('--app-base-font-size')).toBe('24px');
  });

  it('should persist the scale factor to localStorage as a percentage', () => {
    service.setScale(0.8);
    TestBed.flushEffects();
    expect(localStorage.getItem('app_font_scale')).toBe('80');
  });

  it('should restore and apply the chat text size independently from global text size', () => {
    localStorage.setItem('app_font_scale', '115');
    localStorage.setItem('app_chat_text_size', 'small');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});

    const freshService = TestBed.inject(FontScaleService);
    TestBed.flushEffects();

    expect(freshService.scaleFactor()).toBe(1.15);
    expect(freshService.chatTextSize()).toBe('small');
    expect(document.documentElement.style.getPropertyValue('--chat-message-font-size')).toBe(
      '0.8125rem',
    );
  });

  it('should persist and apply chat text size selections', () => {
    service.setChatTextSize('large');
    TestBed.flushEffects();

    expect(localStorage.getItem('app_chat_text_size')).toBe('large');
    expect(document.documentElement.style.getPropertyValue('--chat-message-font-size')).toBe('1rem');
  });

  it('should ignore an invalid stored chat text size', () => {
    localStorage.setItem('app_chat_text_size', 'huge');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});

    const freshService = TestBed.inject(FontScaleService);

    expect(freshService.chatTextSize()).toBe('medium');
  });

  it('should keep scaling in memory when storage writes fail', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    service.setScale(1.5);
    service.setChatTextSize('large');
    expect(() => TestBed.flushEffects()).not.toThrow();

    expect(service.scaleFactor()).toBe(1.5);
    expect(service.chatTextSize()).toBe('large');
    expect(document.documentElement.style.fontSize).toBe('24px');
    expect(document.documentElement.style.getPropertyValue('--chat-message-font-size')).toBe('1rem');
  });

  it('should reset to 100 percent', () => {
    service.setScale(1.5);
    service.reset();
    TestBed.flushEffects();

    expect(service.scaleFactor()).toBe(1.0);
    expect(document.documentElement.style.fontSize).toBe('16px');
    expect(localStorage.getItem('app_font_scale')).toBe('100');
  });
});
