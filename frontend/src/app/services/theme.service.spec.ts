import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    TestBed.resetTestingModule();

    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    vi.spyOn(document.documentElement.classList, 'toggle');
    document.documentElement.style.removeProperty('--color-primary');
    document.documentElement.style.removeProperty('--color-primary-rgb');

    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('--color-primary');
    document.documentElement.style.removeProperty('--color-primary-rgb');
    vi.restoreAllMocks();
    document.documentElement.classList.remove('dark');
    vi.unstubAllGlobals();
  });

  it('should be created', () => {
    service = TestBed.inject(ThemeService);
    expect(service).toBeTruthy();
  });

  it('should default to system theme if no theme is stored', () => {
    service = TestBed.inject(ThemeService);
    expect(service.currentTheme()).toBe('system');
  });

  it('should load theme from local storage on init', () => {
    (window.localStorage.getItem as Mock).mockImplementation((key: string) =>
      key === 'app_theme' ? 'dark' : null,
    );
    service = TestBed.inject(ThemeService);
    expect(window.localStorage.getItem).toHaveBeenCalledWith('app_theme');
    expect(service.currentTheme()).toBe('dark');
  });

  it('should fall back to system theme and remove an invalid stored theme', () => {
    (window.localStorage.getItem as Mock).mockImplementation((key: string) =>
      key === 'app_theme' ? 'invalid-theme' : null,
    );
    service = TestBed.inject(ThemeService);
    expect(service.currentTheme()).toBe('system');
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('app_theme');
  });

  it('should keep the system default when storage reads are blocked', () => {
    (window.localStorage.getItem as Mock).mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });

    expect(() => {
      service = TestBed.inject(ThemeService);
    }).not.toThrow();
    expect(service.currentTheme()).toBe('system');
    expect(service.primaryAccentColor()).toBeNull();
  });

  it('should set theme and update local storage', () => {
    service = TestBed.inject(ThemeService);
    service.setTheme('light');
    expect(service.currentTheme()).toBe('light');
    expect(window.localStorage.setItem).toHaveBeenCalledWith('app_theme', 'light');
  });

  it('should keep applying theme changes when storage writes fail', () => {
    (window.localStorage.setItem as Mock).mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    service = TestBed.inject(ThemeService);

    expect(() => service.setTheme('dark')).not.toThrow();
    TestBed.flushEffects();

    expect(service.currentTheme()).toBe('dark');
    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', true);
  });

  it('should load a valid stored primary accent', () => {
    (window.localStorage.getItem as Mock).mockImplementation((key: string) =>
      key === 'app_primary_accent_color' ? '#3366cc' : null,
    );

    service = TestBed.inject(ThemeService);

    expect(service.primaryAccentColor()).toBe('#3366cc');
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#3366cc');
    expect(document.documentElement.style.getPropertyValue('--color-primary-rgb')).toBe(
      '51 102 204',
    );
  });

  it('should discard an invalid stored primary accent', () => {
    (window.localStorage.getItem as Mock).mockImplementation((key: string) =>
      key === 'app_primary_accent_color' ? 'rgb(1 2 3)' : null,
    );

    service = TestBed.inject(ThemeService);

    expect(service.primaryAccentColor()).toBeNull();
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('app_primary_accent_color');
  });

  it('should reset accent when a profile has no custom colour', () => {
    service = TestBed.inject(ThemeService);
    service.setPrimaryAccentColor('#123456');
    TestBed.flushEffects();

    service.loadFromProfile(null);
    TestBed.flushEffects();

    expect(service.primaryAccentColor()).toBeNull();
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('app_primary_accent_color');
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--color-primary-rgb')).toBe('');
  });

  it('should reset accent when a profile colour is invalid', () => {
    service = TestBed.inject(ThemeService);
    service.setPrimaryAccentColor('#123456');

    service.loadFromProfile({ primary_accent_color: 'not-a-colour' });
    TestBed.flushEffects();

    expect(service.primaryAccentColor()).toBeNull();
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('app_primary_accent_color');
  });

  it('should apply profile accent as the current user authority', () => {
    service = TestBed.inject(ThemeService);

    service.loadFromProfile({ primary_accent_color: '#abcdef' });
    TestBed.flushEffects();

    expect(service.primaryAccentColor()).toBe('#abcdef');
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      'app_primary_accent_color',
      '#abcdef',
    );
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#abcdef');
  });

  it('should reject invalid direct accent updates instead of emitting invalid CSS variables', () => {
    service = TestBed.inject(ThemeService);

    service.setPrimaryAccentColor('#xyzxyz');
    TestBed.flushEffects();

    expect(service.primaryAccentColor()).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
  });

  it('should apply dark theme if theme is dark', () => {
    (window.localStorage.getItem as Mock).mockImplementation((key: string) =>
      key === 'app_theme' ? 'dark' : null,
    );
    service = TestBed.inject(ThemeService);

    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', true);
  });

  it('should apply light theme if theme is light', () => {
    (window.localStorage.getItem as Mock).mockImplementation((key: string) =>
      key === 'app_theme' ? 'light' : null,
    );
    service = TestBed.inject(ThemeService);

    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', false);
  });

  it('should apply dark theme if theme is system and system prefers dark', () => {
    (window.matchMedia as Mock).mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
    }));

    service = TestBed.inject(ThemeService);

    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', true);
  });

  it('should apply light theme if theme is system and system prefers light', () => {
    (window.matchMedia as Mock).mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
    }));

    service = TestBed.inject(ThemeService);

    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', false);
  });

  it('should update theme when signal changes due to effect', () => {
    service = TestBed.inject(ThemeService);
    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', false);

    (document.documentElement.classList.toggle as Mock).mockClear();
    service.setTheme('dark');
    TestBed.flushEffects();

    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', true);
  });

  it('should apply updated theme when system theme changes while in system mode', () => {
    let changeListener: EventListenerOrEventListenerObject | null = null;

    (window.matchMedia as Mock).mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === 'change') changeListener = listener;
      },
    }));

    service = TestBed.inject(ThemeService);
    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', false);
    (document.documentElement.classList.toggle as Mock).mockClear();

    (window.matchMedia as Mock).mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
    }));

    expect(changeListener).toBeTruthy();
    if (changeListener) {
      (changeListener as EventListener)(new Event('change'));
    }

    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', true);
  });
});
