import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of, catchError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ReportUserDto {
  reported_id: string;
  reason_category: string;
  description?: string;
  context_url?: string;
}

export interface ReportResponse {
  success: boolean;
  message: string;
}

export interface ReportCategory {
  value: string;
  label: string;
  icon?: string;
  description?: string;
}

export interface MomentFeedItem {
  id: string;
  author_id: string;
  content_text?: string | null;
  media_urls?: string[];
  voice_note_url?: string | null;
  detected_language?: string | null;
  is_pinned: boolean;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class SafetyService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = environment.apiUrl;

  // Local cache for blocked user IDs (bidirectional: blocked + blocker)
  private _blockedUserIds = signal<Set<string>>(new Set());
  public readonly blockedUserIdsSignal = this._blockedUserIds.asReadonly();

  // Public read-only accessor (could be used for reactivity)
  get blockedUserIds(): ReadonlySet<string> {
    return this._blockedUserIds();
  }

  private readonly MUTED_WORDS_STORAGE_PREFIX = 'hellotalk_muted_words';
  private readonly MUTED_WORDS_ANONYMOUS_OWNER = 'anonymous';
  private readonly mutedWordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
  private activeMutedWordsOwner: string | null = null;
  private _mutedWords = signal<string[]>([]);

  readonly mutedWords = this._mutedWords.asReadonly();

  constructor() {
    effect(() => {
      const owner = this.getMutedWordsOwner();
      this.activateMutedWordsOwner(owner);
    });
  }

  private getMutedWordsOwner(): string {
    return this.authService.currentUser()?.id ?? this.MUTED_WORDS_ANONYMOUS_OWNER;
  }

  private getMutedWordsStorageKey(owner: string): string {
    return `${this.MUTED_WORDS_STORAGE_PREFIX}:${encodeURIComponent(owner)}`;
  }

  private getLocalStorage(): Storage | null {
    try {
      if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) return null;
      return globalThis.localStorage;
    } catch {
      return null;
    }
  }

  private readStorage(storage: Storage, key: string): string | null {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeStorage(storage: Storage, key: string, value: string): boolean {
    try {
      storage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  private removeStorage(storage: Storage, key: string): void {
    try {
      storage.removeItem(key);
    } catch {
      // Storage is best-effort. Keep the in-memory filter usable if removal fails.
    }
  }

  private normaliseMutedWord(value: string): string {
    return value.normalize('NFKC').trim().toLowerCase();
  }

  private parseStoredMutedWords(value: string | null): string[] {
    if (!value) return [];
    try {
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];

      const words: string[] = [];
      const seen = new Set<string>();
      for (const candidate of parsed) {
        if (typeof candidate !== 'string') continue;
        const normalised = this.normaliseMutedWord(candidate);
        if (!normalised || seen.has(normalised)) continue;
        seen.add(normalised);
        words.push(normalised);
      }
      return words;
    } catch {
      return [];
    }
  }

  private loadMutedWordsForOwner(owner: string): string[] {
    const storage = this.getLocalStorage();
    if (!storage) return [];

    const ownerKey = this.getMutedWordsStorageKey(owner);
    const storedForOwner = this.readStorage(storage, ownerKey);
    if (storedForOwner !== null) {
      return this.parseStoredMutedWords(storedForOwner);
    }

    // Anonymous users deliberately get an isolated empty/default namespace. The legacy
    // device-global value is claimed only by the first authenticated user after upgrade.
    if (owner === this.MUTED_WORDS_ANONYMOUS_OWNER) return [];

    const legacyValue = this.readStorage(storage, this.MUTED_WORDS_STORAGE_PREFIX);
    if (legacyValue === null) return [];

    const migratedWords = this.parseStoredMutedWords(legacyValue);
    if (this.writeStorage(storage, ownerKey, JSON.stringify(migratedWords))) {
      this.removeStorage(storage, this.MUTED_WORDS_STORAGE_PREFIX);
    }
    return migratedWords;
  }

  private activateMutedWordsOwner(owner: string): void {
    if (this.activeMutedWordsOwner === owner) return;
    this.activeMutedWordsOwner = owner;
    this._mutedWords.set(this.loadMutedWordsForOwner(owner));
  }

  private ensureMutedWordsOwner(): string {
    const owner = this.getMutedWordsOwner();
    this.activateMutedWordsOwner(owner);
    return owner;
  }

  private persistMutedWords(): void {
    const owner = this.ensureMutedWordsOwner();
    const storage = this.getLocalStorage();
    if (!storage) return;
    this.writeStorage(
      storage,
      this.getMutedWordsStorageKey(owner),
      JSON.stringify(this._mutedWords()),
    );
  }

  addMutedWord(word: string): void {
    this.ensureMutedWordsOwner();
    const normalised = this.normaliseMutedWord(word);
    if (!normalised) return;
    this._mutedWords.update((previous) => {
      if (previous.includes(normalised)) return previous;
      return [...previous, normalised];
    });
    this.persistMutedWords();
  }

  removeMutedWord(word: string): void {
    this.ensureMutedWordsOwner();
    const normalised = this.normaliseMutedWord(word);
    this._mutedWords.update((previous) => previous.filter((item) => item !== normalised));
    this.persistMutedWords();
  }

  isMutedWord(word: string): boolean {
    this.ensureMutedWordsOwner();
    return this._mutedWords().includes(this.normaliseMutedWord(word));
  }

  clearMutedWords(): void {
    const owner = this.ensureMutedWordsOwner();
    this._mutedWords.set([]);
    const storage = this.getLocalStorage();
    if (!storage) return;
    this.removeStorage(storage, this.getMutedWordsStorageKey(owner));
  }

  private tokeniseWordLikeSegments(value: string): string[] {
    const normalised = this.normaliseMutedWord(value);
    if (!normalised) return [];

    const tokens: string[] = [];
    for (const segment of this.mutedWordSegmenter.segment(normalised)) {
      if (segment.isWordLike) tokens.push(segment.segment);
    }
    return tokens;
  }

  private containsMutedWord(text: string, mutedWord: string): boolean {
    const normalisedText = this.normaliseMutedWord(text);
    const normalisedMutedWord = this.normaliseMutedWord(mutedWord);
    if (!normalisedText || !normalisedMutedWord) return false;

    const mutedTokens = this.tokeniseWordLikeSegments(normalisedMutedWord);
    if (mutedTokens.length === 0) {
      // Symbols and emoji do not have word boundaries, so exact normalised substring
      // matching is the least surprising behaviour for those explicit mute terms.
      return normalisedText.includes(normalisedMutedWord);
    }

    const textTokens = this.tokeniseWordLikeSegments(normalisedText);
    if (textTokens.length < mutedTokens.length) return false;

    for (let start = 0; start <= textTokens.length - mutedTokens.length; start += 1) {
      let matches = true;
      for (let offset = 0; offset < mutedTokens.length; offset += 1) {
        if (textTokens[start + offset] !== mutedTokens[offset]) {
          matches = false;
          break;
        }
      }
      if (matches) return true;
    }
    return false;
  }

  /** Apply mute-word filtering to Moments with either content_text or text_content. */
  filterMomentsByMutedWords<
    T extends { content_text?: string | null; text_content?: string | null },
  >(moments: T[] | null | undefined): T[] {
    if (!moments || moments.length === 0) return [];
    this.ensureMutedWordsOwner();
    const muted = this._mutedWords();
    if (muted.length === 0) return moments;

    return moments.filter((moment) => {
      const rawText = moment.content_text ?? moment.text_content;
      if (!rawText) return true;
      return !muted.some((word) => this.containsMutedWord(rawText, word));
    });
  }

  /**
   * Load the initial list of blocked user IDs from the backend.
   * Should be called once after user login / app init.
   */
  async loadBlockedUsers(): Promise<void> {
    if (!this.authService.getAccessToken()) return;
    try {
      const ids = await firstValueFrom(
        this.http.get<string[]>(`${this.apiUrl}/safety/blocked-ids`),
      );
      const newSet = new Set(ids);
      this._blockedUserIds.set(newSet);
    } catch (e) {
      console.error('Failed to load blocked user IDs', e);
    }
  }

  /** Synchronous cache-based check (fast, no network) */
  isUserBlockedCached(userId: string): boolean {
    return this._blockedUserIds().has(userId);
  }

  /** Updates local block cache without contacting the server. */
  setBlockedUserLocal(userId: string, blocked: boolean): void {
    this._blockedUserIds.update((prev) => {
      const next = new Set(prev);
      if (blocked) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      return next;
    });
  }

  reportUser(dto: ReportUserDto): Promise<ReportResponse> {
    return firstValueFrom(this.http.post<ReportResponse>(`${this.apiUrl}/safety/report`, dto));
  }

  async reportUserAsync(dto: ReportUserDto): Promise<ReportResponse> {
    return this.reportUser(dto);
  }

  blockUser(blockedId: string): Promise<{ success: boolean; blocked_id: string }> {
    return firstValueFrom(
      this.http.post<{ success: boolean; blocked_id: string }>(
        `${this.apiUrl}/safety/block/${blockedId}`,
        {},
      ),
    );
  }

  async blockUserAsync(blockedId: string): Promise<{ success: boolean; blocked_id: string }> {
    const res = await this.blockUser(blockedId);
    this._blockedUserIds.update((prev) => {
      const next = new Set(prev);
      next.add(blockedId);
      return next;
    });
    return res;
  }

  unblockUser(blockedId: string): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.post<{ success: boolean }>(`${this.apiUrl}/safety/unblock/${blockedId}`, {}),
    );
  }

  async unblockUserAsync(blockedId: string): Promise<{ success: boolean }> {
    const res = await this.unblockUser(blockedId);
    this._blockedUserIds.update((prev) => {
      const next = new Set(prev);
      next.delete(blockedId);
      return next;
    });
    return res;
  }

  getBlockedIds(): Promise<string[]> {
    if (!this.authService.getAccessToken()) return Promise.resolve([]);
    return firstValueFrom(this.http.get<string[]>(`${this.apiUrl}/safety/blocked-ids`));
  }

  async getBlockedIdsAsync(): Promise<string[]> {
    return this.getBlockedIds();
  }

  async setSilenceUnknownCallers(userId: string, silence: boolean): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<void>(`${this.apiUrl}/safety/silence-unknown-callers`, {
          userId,
          silence,
        }),
      );
    } catch (e) {
      console.error('Failed to update silence unknown callers setting:', e);
    }
  }

  async getSilenceUnknownCallers(userId: string): Promise<boolean> {
    try {
      const { silenceUnknownCallers } = await firstValueFrom(
        this.http.get<{ silenceUnknownCallers: boolean }>(
          `${this.apiUrl}/safety/silence-unknown-callers/${userId}`,
        ),
      );
      return silenceUnknownCallers;
    } catch (e) {
      console.error('Failed to fetch silence unknown callers setting:', e);
      return false;
    }
  }

  /** Returns report categories from the backend.
   *  The response must be localised using the Accept-Language header. */
  getReportCategories(): Promise<ReportCategory[]> {
    return firstValueFrom(
      this.http.get<ReportCategory[]>(`${this.apiUrl}/safety/report-categories`).pipe(
        catchError(() => {
          console.warn('Failed to fetch report categories from backend, using static fallback.');
          return of(this.getStaticReportCategories());
        }),
      ),
    );
  }

  getCategories(): Promise<ReportCategory[]> {
    return this.getReportCategories();
  }

  /** Static fallback category list used when the backend is unreachable. */
  getStaticReportCategories(): ReportCategory[] {
    return this.staticReportCategories;
  }

  private staticReportCategories: ReportCategory[] = [
    {
      value: 'harassment',
      label: 'Harassment',
      icon: '🚫',
      description: 'Unwanted advances, threats, or abusive behaviour',
    },
    {
      value: 'spam',
      label: 'Spam',
      icon: '📧',
      description: 'Unsolicited promotions, phishing, or fraudulent activity',
    },
    {
      value: 'inappropriate_content',
      label: 'Inappropriate Content',
      icon: '🔞',
      description: 'Sexually explicit, violent, or offensive material',
    },
    {
      value: 'fake_profile',
      label: 'Fake Profile',
      icon: '🎭',
      description: 'Pretending to be someone else or using false identity',
    },
    {
      value: 'other',
      label: 'Other',
      icon: '📝',
      description: 'Something else not listed above',
    },
  ];

  async getBlockedUserIds(userId: string): Promise<string[]> {
    if (!this.authService.getAccessToken()) return [];
    try {
      return await firstValueFrom(
        this.http.get<string[]>(`${this.apiUrl}/safety/blocked-ids/${userId}`),
      );
    } catch (e) {
      console.error('Failed to get blocked user IDs:', e);
      return [];
    }
  }

  async getBlockerUserIds(userId: string): Promise<string[]> {
    if (!this.authService.getAccessToken()) return [];
    try {
      return await firstValueFrom(
        this.http.get<string[]>(`${this.apiUrl}/safety/blocker-ids/${userId}`),
      );
    } catch (e) {
      console.error('Failed to get blocker user IDs:', e);
      return [];
    }
  }

  async getBlockedAndBlockerIds(userId: string): Promise<string[]> {
    try {
      return await this.getBlockedAndBlockerIdsStrict(userId);
    } catch (e) {
      console.error('Failed to get blocked and blocker IDs:', e);
      return [];
    }
  }

  /**
   * Loads the bidirectional block graph without converting an outage into an
   * empty graph. Privacy-sensitive discovery callers must use this method so
   * they can fail closed when the graph cannot be verified.
   */
  async getBlockedAndBlockerIdsStrict(userId: string): Promise<string[]> {
    if (!this.authService.getAccessToken()) {
      throw new Error('Authenticated block graph unavailable');
    }

    const ids: unknown = await firstValueFrom(
      this.http.get<unknown>(`${this.apiUrl}/safety/blocked-and-blocker-ids/${userId}`),
    );
    if (
      !Array.isArray(ids) ||
      !ids.every((id) => typeof id === 'string' && id.length > 0 && id === id.trim())
    ) {
      throw new Error('Invalid block graph response');
    }
    return Array.from(new Set(ids));
  }

  async isBlocked(userId: string): Promise<{ blocked: boolean }> {
    // Use cache for a quick answer if possible
    if (this.isUserBlockedCached(userId)) {
      return { blocked: true };
    }
    if (!this.authService.getAccessToken()) return { blocked: false };
    try {
      return await firstValueFrom(
        this.http.get<{ blocked: boolean }>(`${this.apiUrl}/safety/is-blocked/${userId}`),
      );
    } catch (e) {
      console.error('Failed to check block status:', e);
      return { blocked: false };
    }
  }
}
