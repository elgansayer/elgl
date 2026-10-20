import { Injectable } from '@angular/core';

const MAX_CACHE_ENTRIES = 500;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface TranslationCacheEntry {
  value: string;
  timestamp: number;
}

/**
 * Process-local cache for translated private content.
 *
 * Chat and Moment text can contain sensitive personal data. Translation results
 * are therefore intentionally kept in memory only: they must not survive a page
 * reload, browser restart, logout, or another user opening the same browser
 * profile. The cache is a performance optimisation, never a source of truth.
 */
@Injectable({ providedIn: 'root' })
export class TranslationCacheService {
  private readonly cache = new Map<string, TranslationCacheEntry>();

  /** Returns a fresh cached translation for an exact source/target pair. */
  get(text: string, targetLang: string): string | null {
    const key = this.buildKey(text, targetLang);
    if (!key) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > MAX_AGE_MS) {
      this.cache.delete(key);
      return null;
    }

    // Refresh insertion order so the bounded cache behaves as a small LRU.
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  /**
   * Stores a translation for the current application lifetime only.
   * Empty or malformed cache inputs are ignored because cache availability must
   * never affect whether the translation itself can be shown.
   */
  set(text: string, targetLang: string, translatedText: string): void {
    const key = this.buildKey(text, targetLang);
    if (!key || !translatedText.trim()) return;

    this.cache.delete(key);
    this.cache.set(key, {
      value: translatedText,
      timestamp: Date.now(),
    });
    this.evictIfNeeded();
  }

  /** Removes all in-memory translation entries. */
  clear(): void {
    this.cache.clear();
  }

  private buildKey(text: string, targetLang: string): string | null {
    if (!text) return null;
    const normalizedTarget = targetLang.trim().toLowerCase();
    if (!normalizedTarget) return null;

    // JSON encoding is collision-free for this pair and avoids the old
    // non-cryptographic text hash, which could return a translation belonging to
    // a different source string after a hash collision.
    return JSON.stringify([normalizedTarget, text]);
  }

  private evictIfNeeded(): void {
    while (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (oldestKey === undefined) return;
      this.cache.delete(oldestKey);
    }
  }
}
