import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslationCacheService } from './translation-cache.service';

describe('TranslationCacheService', () => {
  let service: TranslationCacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TranslationCacheService);
    service.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    service.clear();
  });

  it('returns null for an uncached translation', () => {
    expect(service.get('Bonjour', 'en')).toBeNull();
  });

  it('stores and retrieves an exact source/target translation in memory', () => {
    service.set('Bonjour', 'en', 'Hello');

    expect(service.get('Bonjour', 'en')).toBe('Hello');
    expect(service.get('Bonjour', 'es')).toBeNull();
    expect(service.get('Hola', 'en')).toBeNull();
  });

  it('normalizes target-language casing and surrounding whitespace', () => {
    service.set('Bonjour', ' EN ', 'Hello');

    expect(service.get('Bonjour', 'en')).toBe('Hello');
  });

  it('clears every in-memory translation entry', () => {
    service.set('Bonjour', 'en', 'Hello');
    service.set('Hola', 'en', 'Hi');

    service.clear();

    expect(service.get('Bonjour', 'en')).toBeNull();
    expect(service.get('Hola', 'en')).toBeNull();
  });

  it('never writes private translation content to localStorage', () => {
    const setItem = vi.spyOn(localStorage, 'setItem');
    const getItem = vi.spyOn(localStorage, 'getItem');

    service.set('Private chat sentence', 'en', 'Private translated sentence');
    expect(service.get('Private chat sentence', 'en')).toBe('Private translated sentence');

    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });

  it('does not persist translations into a fresh service instance', () => {
    service.set('Bonjour', 'en', 'Hello');

    const freshService = new TranslationCacheService();

    expect(freshService.get('Bonjour', 'en')).toBeNull();
  });

  it('expires cached translations after seven days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'));
    service.set('Bonjour', 'en', 'Hello');

    vi.setSystemTime(new Date('2026-08-09T00:00:00Z'));

    expect(service.get('Bonjour', 'en')).toBeNull();
  });

  it('keeps the cache bounded and evicts the least recently used entry', () => {
    for (let index = 0; index < 500; index += 1) {
      service.set(`source-${index}`, 'en', `target-${index}`);
    }

    // Touch source-0 so source-1 becomes the least recently used entry.
    expect(service.get('source-0', 'en')).toBe('target-0');
    service.set('source-500', 'en', 'target-500');

    expect(service.get('source-0', 'en')).toBe('target-0');
    expect(service.get('source-1', 'en')).toBeNull();
    expect(service.get('source-500', 'en')).toBe('target-500');
  });

  it('ignores empty source, target-language, or translated values', () => {
    service.set('', 'en', 'Hello');
    service.set('Bonjour', '', 'Hello');
    service.set('Bonjour', 'en', '   ');

    expect(service.get('', 'en')).toBeNull();
    expect(service.get('Bonjour', '')).toBeNull();
    expect(service.get('Bonjour', 'en')).toBeNull();
  });
});
