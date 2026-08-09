import { Injectable } from '@nestjs/common';
import { Language } from 'node-nlp';

interface SpamRecord {
  timestamps: number[];
  trigrams: Set<string>;
}

@Injectable()
export class SpamDetectionService {
  private readonly cache = new Map<string, SpamRecord>();

  private readonly THRESHOLD = parseInt(
    process.env.SPAM_DUPLICATE_THRESHOLD ?? '3',
    10,
  );

  private readonly WINDOW_MS = 60 * 60 * 1000; // 1 hour

  private readonly TRIGRAM_N = 3;

  private readonly SIMILARITY_THRESHOLD = parseFloat(
    process.env.SPAM_SIMILARITY_THRESHOLD ?? '0.75',
  );

  private readonly languageDetector = new Language();

  private readonly CJK_LANGUAGES = new Set(['ja', 'ko', 'zh', 'th']);

  isSpam(content: string): boolean {
    if (!content) return false;

    const normalized = content.trim().toLowerCase();
    const now = Date.now();

    // Remove entries whose latest timestamp is older than the window
    for (const [key, record] of this.cache) {
      const latest = Math.max(...record.timestamps);
      if (now - latest > this.WINDOW_MS) {
        this.cache.delete(key);
      }
    }

    // Determine appropriate n-gram size based on detected language
    const trigramN = this.getTrigramSize(normalized);

    // Compute trigram set for the incoming message
    const incomingTrigrams = this.trigramSet(normalized, trigramN);

    // Count how many existing messages are similar enough
    let nearDuplicateCount = 0;

    for (const record of this.cache.values()) {
      const storedTrigrams = record.trigrams;
      const similarity = this.jaccard(incomingTrigrams, storedTrigrams);
      if (similarity >= this.SIMILARITY_THRESHOLD) {
        nearDuplicateCount++;
      }
    }

    // If we already have (THRESHOLD-1) duplicates, flag as spam
    if (nearDuplicateCount >= this.THRESHOLD - 1) {
      this.addRecord(normalized, incomingTrigrams, now);
      return true;
    }

    // Record this occurrence
    this.addRecord(normalized, incomingTrigrams, now);

    // Prevent unbounded growth: only keep last 1000 entries
    if (this.cache.size > 1000) {
      const firstKey = Array.from(this.cache.keys())[0];
      if (firstKey) this.cache.delete(firstKey);
    }

    return false;
  }

  private addRecord(content: string, trigrams: Set<string>, now: number): void {
    // Truncated content used as the cache key
    const MAX_LENGTH = 200;
    const key = content.substring(0, MAX_LENGTH);

    let record = this.cache.get(key);
    if (!record) {
      record = { timestamps: [], trigrams };
      this.cache.set(key, record);
    }
    record.timestamps.push(now);
    record.trigrams = trigrams;
  }

  /** Generate a set of character n‑grams */
  private trigramSet(content: string, n: number = this.TRIGRAM_N): Set<string> {
    const set = new Set<string>();
    for (let i = 0; i <= content.length - n; i++) {
      set.add(content.substring(i, i + n));
    }
    // For very short content, use the entire string as a single token
    if (set.size === 0) {
      set.add(content);
    }
    return set;
  }

  /** Jaccard similarity of two sets */
  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 1;
    const intersection = new Set([...a].filter((x) => b.has(x)));
    const union = new Set([...a, ...b]);
    return intersection.size / union.size;
  }

  /**
   * Detect the language of the given text and return an appropriate
   * n‑gram size. For CJK languages we use bigrams (n=2); otherwise
   * we fall back to the default trigram (n=3).
   */
  private getTrigramSize(text: string): number {
    try {
      const guesses = this.languageDetector.guess(text, undefined, 1);
      if (guesses && guesses.length > 0) {
        const lang = guesses[0].alpha2;
        if (this.CJK_LANGUAGES.has(lang)) {
          return 2;
        }
      }
    } catch {
      // If language detection fails, just use the configured default
    }
    return this.TRIGRAM_N;
  }
}
