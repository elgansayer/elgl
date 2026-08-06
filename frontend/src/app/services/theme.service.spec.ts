import { TestBed } from '@angular/core/testing';
<<<<<<< HEAD
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeService } from './theme.service';
import { signal } from '@angular/core';
=======
import { describe, it, expect, beforeEach, vi, afterEach, Mock } from 'vitest';
import { ThemeService } from './theme.service';
>>>>>>> origin/main

describe('ThemeService', () => {
  let service: ThemeService;

<<<<<<< HEAD
  // Mocks
  let matchMediaMock: any;
  let addEventListenerMock: any;
  let matchesMock: boolean;

  let localStorageMock: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock localStorage
    const store: Record<string, string> = {};
    localStorageMock = {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        for (const key in store) delete store[key];
      }),
    };

    vi.stubGlobal('localStorage', localStorageMock);

    // Mock window.matchMedia
    matchesMock = false;
    addEventListenerMock = vi.fn();

    matchMediaMock = vi.fn().mockImplementation((query) => {
      return {
        matches: matchesMock,
        media: query,
        onchange: null,
        addListener: vi.fn(), // Deprecated
        removeListener: vi.fn(), // Deprecated
        addEventListener: addEventListenerMock,
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    });

    vi.stubGlobal('matchMedia', matchMediaMock);

    // Reset document classes
    document.documentElement.className = '';

    // Reset Angular testing module
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [ThemeService]
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Initialization', () => {
    it('should initialize with system theme by default', () => {
      service = TestBed.inject(ThemeService);
      expect(service.currentTheme()).toBe('system');
    });

    it('should restore theme from localStorage if available', () => {
      localStorageMock.getItem.mockReturnValue('dark');
      service = TestBed.inject(ThemeService);

      expect(localStorageMock.getItem).toHaveBeenCalledWith('app_theme');
      expect(service.currentTheme()).toBe('dark');
    });

    it('should ignore invalid theme values in localStorage', () => {
      localStorageMock.getItem.mockReturnValue('invalid-theme');
      service = TestBed.inject(ThemeService);

      expect(service.currentTheme()).toBe('system');
    });

    it('should listen for system preference changes when system theme is active', () => {
      service = TestBed.inject(ThemeService);
      expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  describe('setTheme', () => {
    beforeEach(() => {
      service = TestBed.inject(ThemeService);
    });

    it('should update currentTheme signal', () => {
      service.setTheme('light');
      expect(service.currentTheme()).toBe('light');
    });

    it('should save theme to localStorage', () => {
      service.setTheme('dark');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('app_theme', 'dark');
    });
  });

  describe('applyTheme', () => {
    it('should add dark class when theme is dark', () => {
      service = TestBed.inject(ThemeService);
      // effects run asynchronously. we have to test it manually, or wait.
      // however, we can test it directly via effect execution if we flush effects,
      // or we can test it by manually calling applyTheme (but it's private).
      // we can also just use flushEffects
      TestBed.flushEffects();
      service.setTheme('dark');
      TestBed.flushEffects();

      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should remove dark class when theme is light', () => {
      // Start with dark class
      document.documentElement.classList.add('dark');

      service = TestBed.inject(ThemeService);
      TestBed.flushEffects();
      service.setTheme('light');
      TestBed.flushEffects();

      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should add dark class when theme is system and system prefers dark', () => {
      matchesMock = true; // System prefers dark
      service = TestBed.inject(ThemeService);
      TestBed.flushEffects();

      expect(matchMediaMock).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should not add dark class when theme is system and system prefers light', () => {
      matchesMock = false; // System prefers light
      service = TestBed.inject(ThemeService);
      TestBed.flushEffects();

      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should re-evaluate theme when system preference changes and theme is system', () => {
      matchesMock = false; // Initially light
      service = TestBed.inject(ThemeService);
      TestBed.flushEffects();

      expect(document.documentElement.classList.contains('dark')).toBe(false);

      // Simulate system changing to dark
      matchesMock = true;

      // Get the change callback registered in constructor
      const changeCallback = addEventListenerMock.mock.calls[0][1];

      // Call it
      changeCallback();
      TestBed.flushEffects();

      // Now it should be dark
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should ignore system preference changes when theme is explicitly set', () => {
      matchesMock = false;
      service = TestBed.inject(ThemeService);
      TestBed.flushEffects();

      // Explicitly set to light
      service.setTheme('light');
      TestBed.flushEffects();
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      // Simulate system changing to dark
      matchesMock = true;

      // Get the change callback
      const changeCallback = addEventListenerMock.mock.calls[0][1];

      // Call it
      changeCallback();
      TestBed.flushEffects();

      // Should still be light because user explicitly chose light
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
=======
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
      writable: true
    });

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(_query => ({
        matches: false,
        media: _query,
        onchange: null,
        addListener: vi.fn(), // Deprecated
        removeListener: vi.fn(), // Deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Mock document.documentElement.classList.toggle
    document.documentElement.classList.toggle = vi.fn();

    TestBed.configureTestingModule({});
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
    (window.matchMedia as Mock).mockImplementation(_query => ({
      matches: _query === '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
    }));

    service = TestBed.inject(ThemeService);

    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', true);
  });

  it('should apply light theme if theme is system and system prefers light', () => {
    (window.matchMedia as Mock).mockImplementation(_query => ({
      matches: false,
      addEventListener: vi.fn(),
    }));

    service = TestBed.inject(ThemeService);

    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', false);
  });

  it('should update theme when signal changes due to effect', async () => {
    service = TestBed.inject(ThemeService);
    // document.documentElement.classList.toggle should have been called with false (system, matchMedia false)
    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', false);

    // Clear mock to check subsequent calls
    (document.documentElement.classList.toggle as Mock).mockClear();

    TestBed.flushEffects();

    service.setTheme('dark');

    TestBed.flushEffects();

    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', true);
  });

  it('should apply updated theme when system theme changes while in system mode', () => {
    let changeListener: EventListenerOrEventListenerObject | null = null;

    (window.matchMedia as Mock).mockImplementation(_query => ({
      matches: false,
      media: _query,
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === 'change') changeListener = listener;
      }
    }));

    service = TestBed.inject(ThemeService);
    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', false);
    (document.documentElement.classList.toggle as Mock).mockClear();

    // Simulate system theme changing to dark
    (window.matchMedia as Mock).mockImplementation(_query => ({
      matches: true,
      media: _query,
      addEventListener: vi.fn()
    }));

    expect(changeListener).toBeTruthy();
    if (changeListener && typeof changeListener === 'function') {
      changeListener(new Event('change'));
    }

    expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', true);
>>>>>>> origin/main
  });
});
