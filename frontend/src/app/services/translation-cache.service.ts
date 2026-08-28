import { Injectable } from '@angular/core';

const TRANSLATION_CACHE_PREFIX = 'elgl:tr:';
const MAX_CACHE_ENTRIES = 500;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable({ providedIn: 'root' })
export class TranslationCacheService {
  /**
   * Returns a cached translation for the given text+targetLang pair,
   * or null if no valid cached entry exists.
   */
  get(text: string, targetLang: string): string | null {
    const key = this.buildKey(text, targetLang);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      const entry = JSON.parse(raw) as { value: string; timestamp: number };
      if (Date.now() - entry.timestamp > MAX_AGE_MS) {
        localStorage.removeItem(key);
        return null;
      }
      return entry.value;
    } catch {
      localStorage.removeItem(key);
      return null;
    }
  }

  /**
   * Stores a translation result for the given text+targetLang pair.
   */
  set(text: string, targetLang: string, translatedText: string): void {
    this.evictIfNeeded();
    const key = this.buildKey(text, targetLang);
    const entry = { value: translatedText, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  }

  /**
   * Removes all translation cache entries.
   */
  clear(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(TRANSLATION_CACHE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  }

  private buildKey(text: string, targetLang: string): string {
    // Simple hash for storage key - we use the text directly truncated to avoid
    // giant keys for very long texts, but prepend a hash for uniqueness
    const hash = this.hashString(text);
    return `${TRANSLATION_CACHE_PREFIX}${hash}:${targetLang}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash + chr) | 0;
    }
    return Math.abs(hash).toString(36);
  }

  private evictIfNeeded(): void {
    const keys: Array<{ key: string; timestamp: number }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(TRANSLATION_CACHE_PREFIX)) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const entry = JSON.parse(raw) as { timestamp: number };
            keys.push({ key: k, timestamp: entry.timestamp ?? 0 });
          } catch {
            keys.push({ key: k, timestamp: 0 });
          }
        }
      }
    }
    if (keys.length > MAX_CACHE_ENTRIES) {
      keys.sort((a, b) => a.timestamp - b.timestamp);
      const toRemove = keys.slice(0, keys.length - MAX_CACHE_ENTRIES + 50);
      toRemove.forEach(({ key }) => localStorage.removeItem(key));
    }
  }
}