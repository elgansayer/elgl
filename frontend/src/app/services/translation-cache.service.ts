import { Injectable } from '@angular/core';

const TRANSLATION_CACHE_PREFIX = 'elgl:tr:';
const MAX_CACHE_ENTRIES = 500;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface TranslationCacheEntry {
  sourceText: string;
  targetLanguage: string;
  value: string;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class TranslationCacheService {
  /**
   * Returns a cached translation for the given text+targetLang pair,
   * or null if no valid cached entry exists. Browser storage is an optional
   * optimisation: privacy modes, quota failures, or disabled storage must never
   * break translation actions.
   */
  get(text: string, targetLang: string): string | null {
    const key = this.buildKey(text, targetLang);
    let raw: string | null;

    try {
      raw = localStorage.getItem(key);
    } catch {
      return null;
    }

    if (!raw) return null;

    try {
      const entry = JSON.parse(raw) as Partial<TranslationCacheEntry>;
      if (
        typeof entry.value !== 'string' ||
        typeof entry.timestamp !== 'number' ||
        Date.now() - entry.timestamp > MAX_AGE_MS ||
        (typeof entry.sourceText === 'string' && entry.sourceText !== text) ||
        (typeof entry.targetLanguage === 'string' && entry.targetLanguage !== targetLang)
      ) {
        this.removeSafely(key);
        return null;
      }
      return entry.value;
    } catch {
      this.removeSafely(key);
      return null;
    }
  }

  /**
   * Stores a translation result for the given text+targetLang pair.
   * Cache writes are best-effort and intentionally never make a successful
   * translation fail when browser storage is unavailable.
   */
  set(text: string, targetLang: string, translatedText: string): void {
    if (!translatedText) return;

    try {
      this.evictIfNeeded();
      const key = this.buildKey(text, targetLang);
      const entry: TranslationCacheEntry = {
        sourceText: text,
        targetLanguage: targetLang,
        value: translatedText,
        timestamp: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(entry));
    } catch {
      // Storage is an optional performance optimisation. Ignore quota/security
      // failures so the translated result can still be rendered to the user.
    }
  }

  /** Removes all translation cache entries without failing the caller. */
  clear(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(TRANSLATION_CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => this.removeSafely(key));
    } catch {
      // Clearing a cache must remain safe when storage access is denied.
    }
  }

  private buildKey(text: string, targetLang: string): string {
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

  private removeSafely(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Best-effort cache cleanup only.
    }
  }

  private evictIfNeeded(): void {
    const keys: Array<{ key: string; timestamp: number }> = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(TRANSLATION_CACHE_PREFIX)) continue;

        const raw = localStorage.getItem(key);
        if (!raw) continue;

        try {
          const entry = JSON.parse(raw) as { timestamp?: number };
          keys.push({ key, timestamp: entry.timestamp ?? 0 });
        } catch {
          keys.push({ key, timestamp: 0 });
        }
      }
    } catch {
      return;
    }

    if (keys.length > MAX_CACHE_ENTRIES) {
      keys.sort((a, b) => a.timestamp - b.timestamp);
      const toRemove = keys.slice(0, keys.length - MAX_CACHE_ENTRIES + 50);
      toRemove.forEach(({ key }) => this.removeSafely(key));
    }
  }
}
