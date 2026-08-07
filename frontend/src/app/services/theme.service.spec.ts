import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { DOCUMENT } from '@angular/common';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let setPropertySpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.resetTestingModule();

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((_query) => ({
        matches: false,
        media: _query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Mock document.documentElement.classList.toggle
    document.documentElement.classList.toggle = vi.fn();

    // Spy on style.setProperty
    setPropertySpy = vi.fn();
    Object.defineProperty(document.documentElement, 'style', {
      value: {
        setProperty: setPropertySpy,
        fontSize: '',
      },
      writable: true,
    });

    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: document }],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    service = TestBed.inject(ThemeService);
    expect(service).toBeTruthy();
  });

  it('should default to system theme if no theme in local storage', () => {
    service = TestBed.inject(ThemeService);
    expect(service.currentTheme()).toBe('system');
  });

  it('should load theme from local storage on init', () => {
    (window.localStorage.getItem as Mock).mockReturnValue('dark');
    service = TestBed.inject(ThemeService);
    expect(window.localStorage.getItem).toHaveBeenCalledWith('app_theme');
    expect(service.currentTheme()).toBe('dark');
  });

  it('should fallback to system theme if local storage theme is invalid', () => {
    (window.localStorage.getItem as Mock).mockReturnValue('invalid-theme');
    service = TestBed.inject(ThemeService);
    expect(service.currentTheme()).toBe('system');
  });

  it('should set theme and update local storage', () => {
    service = TestBed.inject(ThemeService);
    service.setTheme('light');
    expect(service.currentTheme()).toBe('light');
    expect(window.localStorage.setItem).toHaveBeenCalledWith('app_theme', 'light');
  });

  it('should apply dark theme if theme is dark', () => {
    (window.localStorage.getItem as Mock).mockReturnValue('dark');
    service = TestBed.inject(ThemeService);

    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', true);
  });

  it('should apply light theme if theme is light', () => {
    (window.localStorage.getItem as Mock).mockReturnValue('light');
    service = TestBed.inject(ThemeService);

    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', false);
  });

  it('should apply dark theme if theme is system and system prefers dark', () => {
    (window.matchMedia as Mock).mockImplementation((_query) => ({
      matches: _query === '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
    }));

    service = TestBed.inject(ThemeService);

    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', true);
  });

  it('should apply light theme if theme is system and system prefers light', () => {
    (window.matchMedia as Mock).mockImplementation((_query) => ({
      matches: false,
      addEventListener: vi.fn(),
    }));

    service = TestBed.inject(ThemeService);

    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', false);
  });

  it('should update theme when signal changes due to effect', async () => {
    service = TestBed.inject(ThemeService);
    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', false);

    (document.documentElement.classList.toggle as Mock).mockClear();

    TestBed.flushEffects();

    service.setTheme('dark');

    TestBed.flushEffects();

    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', true);
  });

  it('should apply updated theme when system theme changes while in system mode', () => {
    let changeListener: EventListenerOrEventListenerObject | null = null;

    (window.matchMedia as Mock).mockImplementation((_query) => ({
      matches: false,
      media: _query,
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === 'change') changeListener = listener;
      },
    }));

    service = TestBed.inject(ThemeService);
    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', false);
    (document.documentElement.classList.toggle as Mock).mockClear();

    (window.matchMedia as Mock).mockImplementation((_query) => ({
      matches: true,
      media: _query,
      addEventListener: vi.fn(),
    }));

    expect(changeListener).toBeTruthy();
    if (changeListener) {
      (changeListener as EventListener)(new Event('change'));
    }

    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', true);
  });

  it('should default accent colour to #4f46e5', () => {
    service = TestBed.inject(ThemeService);

    expect(service.primaryAccentColor()).toBe('#4f46e5');
  });

  it('should set primary accent colour and persist to localStorage', () => {
    service = TestBed.inject(ThemeService);
    setPropertySpy.mockClear();

    service.setPrimaryAccentColor('#e11d48');

    expect(service.primaryAccentColor()).toBe('#e11d48');
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      'app_primary_accent_color',
      '#e11d48',
    );
  });

  it('should apply accent colour as CSS custom properties', () => {
    service = TestBed.inject(ThemeService);
    setPropertySpy.mockClear();

    service.setPrimaryAccentColor('#16a34a');

    TestBed.flushEffects();

    expect(setPropertySpy).toHaveBeenCalledWith('--color-primary-rgb', '22 163 74');
    expect(setPropertySpy).toHaveBeenCalledWith('--color-primary', '#16a34a');
  });

  it('should load accent colour from profile', () => {
    service = TestBed.inject(ThemeService);

    service.loadFromProfile({ primary_accent_color: '#ff0000' });

    expect(service.primaryAccentColor()).toBe('#ff0000');
  });

  it('should fallback to default accent when profile has no colour', () => {
    service = TestBed.inject(ThemeService);

    service.loadFromProfile(null);

    expect(service.primaryAccentColor()).toBe('#4f46e5');
  });
});
