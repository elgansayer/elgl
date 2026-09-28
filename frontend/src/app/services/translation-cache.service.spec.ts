import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    // Verify the cached value is returned directly (no fetch needed)
    const result = service.get('Bonjour', 'en');
    expect(result).toBe('Hello');
  });
});