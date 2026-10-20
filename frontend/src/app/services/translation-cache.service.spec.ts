import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslationCacheService } from './translation-cache.service';

const mockStore: Record<string, string> = {};
const originalLocalStorage = globalThis.localStorage;

describe('TranslationCacheService', () => {
  let service: TranslationCacheService;

  beforeEach(() => {
    Object.keys(mockStore).forEach((k) => delete mockStore[k]);
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => mockStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStore[key];
      }),
      clear: vi.fn(() => {
        Object.keys(mockStore).forEach((k) => delete mockStore[k]);
      }),
      get length() {
        return Object.keys(mockStore).length;
      },
      key: vi.fn((index: number) => Object.keys(mockStore)[index] ?? null),
    };
    globalThis.localStorage = mockLocalStorage as unknown as Storage;

    TestBed.configureTestingModule({});
    service = TestBed.inject(TranslationCacheService);
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.localStorage = originalLocalStorage;
  });

  it('should return null for an uncached translation', () => {
    expect(service.get('Bonjour', 'en')).toBeNull();
  });

  it('should store and retrieve a translation', () => {
    service.set('Bonjour', 'en', 'Hello');
    expect(service.get('Bonjour', 'en')).toBe('Hello');
  });

  it('should return null for a different target language', () => {
    service.set('Bonjour', 'en', 'Hello');
    expect(service.get('Bonjour', 'es')).toBeNull();
  });

  it('should return null for a different source text', () => {
    service.set('Bonjour', 'en', 'Hello');
    expect(service.get('Hola', 'en')).toBeNull();
  });

  it('should clear all translation cache entries', () => {
    service.set('Bonjour', 'en', 'Hello');
    service.set('Hola', 'en', 'Hi');
    service.clear();
    expect(service.get('Bonjour', 'en')).toBeNull();
    expect(service.get('Hola', 'en')).toBeNull();
  });

  it('should not clear non-translation localStorage entries', () => {
    localStorage.setItem('other-key', 'value');
    service.set('Bonjour', 'en', 'Hello');
    service.clear();
    expect(localStorage.getItem('other-key')).toBe('value');
  });

  it('should serve cached translation without additional API calls', () => {
    service.set('Bonjour', 'en', 'Hello');
    const result = service.get('Bonjour', 'en');
    expect(result).toBe('Hello');
  });

  it('should fail open to a cache miss when storage reads are blocked', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError');
    });

    expect(() => service.get('Bonjour', 'en')).not.toThrow();
    expect(service.get('Bonjour', 'en')).toBeNull();
  });

  it('should keep a successful translation usable when cache writes fail', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    expect(() => service.set('Bonjour', 'en', 'Hello')).not.toThrow();
  });

  it('should make cache clearing best-effort when storage access is blocked', () => {
    Object.defineProperty(localStorage, 'length', {
      configurable: true,
      get: () => {
        throw new DOMException('Storage blocked', 'SecurityError');
      },
    });

    expect(() => service.clear()).not.toThrow();
  });

  it('should discard malformed cached values without throwing', () => {
    service.set('Bonjour', 'en', 'Hello');
    const cacheKey = Object.keys(mockStore).find((key) => key.startsWith('elgl:tr:'))!;
    mockStore[cacheKey] = '{invalid-json';

    expect(service.get('Bonjour', 'en')).toBeNull();
    expect(mockStore[cacheKey]).toBeUndefined();
  });

  it('should reject a cached entry whose source metadata does not match', () => {
    service.set('Bonjour', 'en', 'Hello');
    const cacheKey = Object.keys(mockStore).find((key) => key.startsWith('elgl:tr:'))!;
    const entry = JSON.parse(mockStore[cacheKey]) as Record<string, unknown>;
    mockStore[cacheKey] = JSON.stringify({ ...entry, sourceText: 'Different source' });

    expect(service.get('Bonjour', 'en')).toBeNull();
  });

  it('should expire cached translations after seven days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'));
    service.set('Bonjour', 'en', 'Hello');

    vi.setSystemTime(new Date('2026-08-09T00:00:00Z'));

    expect(service.get('Bonjour', 'en')).toBeNull();
  });

  it('should continue reading legacy cache entries without source metadata', () => {
    service.set('Bonjour', 'en', 'Hello');
    const cacheKey = Object.keys(mockStore).find((key) => key.startsWith('elgl:tr:'))!;
    const entry = JSON.parse(mockStore[cacheKey]) as {
      value: string;
      timestamp: number;
    };
    mockStore[cacheKey] = JSON.stringify({ value: entry.value, timestamp: entry.timestamp });

    expect(service.get('Bonjour', 'en')).toBe('Hello');
  });
});
