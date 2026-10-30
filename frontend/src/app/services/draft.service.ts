import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

export interface MomentDraft {
  text?: string;
  mediaUrls?: string[];
  mediaType?: 'none' | 'images' | 'audio';
  targetLanguage?: string;
  voiceDurationSec?: number | null;
}

export interface ChatDraft {
  textInput?: string;
  replyToId?: string | null;
  originalText?: string;
  correctedText?: string;
  explanationText?: string;
}

// Raw-text chat key written before the enriched record existed. It is only read as a fallback
// and is removed whenever the room draft is cleared, expired or swept.
const CHAT_DRAFT_PREFIX = 'draft_chat_';
const CHAT_DRAFT_V2_PREFIX = 'draft_chat_v2_';
const MOMENT_DRAFT_KEY = 'draft_moment';
// Matches the drafts of every account so records left by other accounts are retired too.
const DRAFT_KEY_PATTERN = /^(ht_[^_]+)_draft_(chat_v2_|chat_|moment)(.*)$/;

const MAX_ROOM_ID_LENGTH = 160;
const MAX_CHAT_TEXT_LENGTH = 10_000;
const MAX_CORRECTION_TEXT_LENGTH = 10_000;
const MAX_MOMENT_TEXT_LENGTH = 10_000;
const MAX_MEDIA_URLS = 9;
const MAX_MEDIA_URL_LENGTH = 4_096;
const MAX_LANGUAGE_CODE_LENGTH = 32;
const MAX_SERIALIZED_DRAFT_LENGTH = 96_000;
const MAX_MOMENT_VOICE_SECONDS = 60;
// A draft is discarded once it has gone this long without being saved again.
const DRAFT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorName(error: unknown): string {
  return isRecord(error) && typeof error['name'] === 'string' ? error['name'] : 'UnknownError';
}

/**
 * Browser-local storage for unsent chat messages and Moment compositions.
 *
 * Each draft is one JSON record stamped with the time it was last saved. Records are scoped to the
 * signed-in account, expire after {@link DRAFT_RETENTION_MS}, and are removed when the message is
 * sent or the composer is emptied. Persistence is best-effort: storage failures never surface to
 * the composer.
 */
@Injectable({ providedIn: 'root' })
export class DraftService {
  private readonly authService = inject(AuthService);
  private swept = false;
  private warnedAboutWriteFailure = false;

  private storage(): Storage | null {
    try {
      if (typeof globalThis.localStorage === 'undefined') return null;
      return globalThis.localStorage;
    } catch {
      // Browsers can expose localStorage but throw when storage access is blocked
      // (for example, privacy settings, sandboxed frames or disabled cookies).
      return null;
    }
  }

  private safeGet(key: string): string | null {
    try {
      return this.storage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private safeSet(key: string, value: string): boolean {
    if (value.length > MAX_SERIALIZED_DRAFT_LENGTH) return false;
    try {
      const storage = this.storage();
      if (!storage) return false;
      storage.setItem(key, value);
      return true;
    } catch (error) {
      // Draft persistence is best-effort. Quota/security failures must never
      // prevent composing or sending a message/Moment.
      this.reportWriteFailure(error);
      return false;
    }
  }

  private safeRemove(key: string): void {
    try {
      this.storage()?.removeItem(key);
    } catch {
      // A storage failure must not break the primary messaging flow.
    }
  }

  // Only the error name is reported, once per session: neither draft content nor storage keys
  // (which carry account and room identifiers) may reach the console.
  private reportWriteFailure(error: unknown): void {
    if (this.warnedAboutWriteFailure) return;
    this.warnedAboutWriteFailure = true;
    console.warn('Local draft storage is unavailable; unsent text will not survive a reload.', {
      reason: errorName(error),
    });
  }

  private getUserPrefix(): string {
    const userId = this.authService.currentUser()?.id;
    return userId ? `ht_${userId}` : 'ht_anon';
  }

  private normaliseRoomId(roomId: string): string | null {
    const normalised = roomId.trim();
    if (!normalised || normalised.length > MAX_ROOM_ID_LENGTH) return null;
    return encodeURIComponent(normalised);
  }

  private chatKey(roomId: string): string | null {
    const normalisedRoomId = this.normaliseRoomId(roomId);
    return normalisedRoomId
      ? `${this.getUserPrefix()}_${CHAT_DRAFT_PREFIX}${normalisedRoomId}`
      : null;
  }

  private chatV2Key(roomId: string): string | null {
    const normalisedRoomId = this.normaliseRoomId(roomId);
    return normalisedRoomId
      ? `${this.getUserPrefix()}_${CHAT_DRAFT_V2_PREFIX}${normalisedRoomId}`
      : null;
  }

  private momentKey(): string {
    return `${this.getUserPrefix()}_${MOMENT_DRAFT_KEY}`;
  }

  // Blank and oversized strings are treated as absent rather than truncated, so a restored draft
  // is never a silently altered version of what the learner wrote.
  private boundedText(value: unknown, maxLength: number): string | undefined {
    return typeof value === 'string' && value.trim() !== '' && value.length <= maxLength
      ? value
      : undefined;
  }

  private validMediaUrl(value: unknown): value is string {
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_MEDIA_URL_LENGTH) {
      return false;
    }

    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  }

  /** Reads and validates a stored JSON object, discarding records that are oversized or corrupt. */
  private readRecord(key: string): Record<string, unknown> | null {
    const raw = this.safeGet(key);
    if (raw === null) return null;
    if (raw.length > MAX_SERIALIZED_DRAFT_LENGTH) {
      this.safeRemove(key);
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (isRecord(parsed)) return parsed;
    } catch {
      // Fall through: unparseable records are removed below.
    }
    this.safeRemove(key);
    return null;
  }

  /** Records written by earlier versions carry no timestamp and are treated as current. */
  private isExpired(record: Record<string, unknown>, now: number): boolean {
    const savedAt = record['savedAt'];
    return (
      typeof savedAt === 'number' && Number.isFinite(savedAt) && now - savedAt > DRAFT_RETENTION_MS
    );
  }

  private writeRecord(key: string, draft: object, now = Date.now()): boolean {
    return this.safeSet(key, JSON.stringify({ ...draft, savedAt: now }));
  }

  /**
   * Retires expired drafts, migrates raw-text chat drafts into stamped records and stamps records
   * written before timestamps existed, so retention applies to every stored draft. Runs once per
   * service instance, before the first draft is read or written.
   */
  private ensureSwept(): void {
    if (this.swept) return;
    this.swept = true;

    const storage = this.storage();
    if (!storage) return;

    const keys: string[] = [];
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && DRAFT_KEY_PATTERN.test(key)) keys.push(key);
      }
    } catch {
      return;
    }

    const now = Date.now();
    for (const key of keys) this.sweepKey(key, now);
  }

  private sweepKey(key: string, now: number): void {
    const match = DRAFT_KEY_PATTERN.exec(key);
    if (!match) return;
    const [, namespace, kind, roomSuffix] = match;
    if (kind === 'moment' && roomSuffix !== '') return;

    if (kind === 'chat_') {
      this.sweepLegacyChatKey(key, `${namespace}_${CHAT_DRAFT_V2_PREFIX}${roomSuffix}`, now);
      return;
    }

    const record = this.readRecord(key);
    if (!record) return;

    if (this.isExpired(record, now)) {
      this.safeRemove(key);
      if (kind === 'chat_v2_') this.safeRemove(`${namespace}_${CHAT_DRAFT_PREFIX}${roomSuffix}`);
    } else if (typeof record['savedAt'] !== 'number') {
      this.safeSet(key, JSON.stringify({ ...record, savedAt: now }));
    }
  }

  private sweepLegacyChatKey(key: string, currentKey: string, now: number): void {
    if (this.safeGet(currentKey) !== null) {
      this.safeRemove(key);
      return;
    }

    const textInput = this.boundedText(this.safeGet(key), MAX_CHAT_TEXT_LENGTH);
    if (textInput === undefined || this.writeRecord(currentKey, { textInput }, now)) {
      this.safeRemove(key);
    }
  }

  // ---- Chat drafts ----

  /** Validates untrusted input (a caller's draft or a stored record). Null means nothing worth keeping. */
  private parseChatDraft(value: unknown): ChatDraft | null {
    if (!isRecord(value)) return null;

    const draft: ChatDraft = {};
    const textInput = this.boundedText(value['textInput'], MAX_CHAT_TEXT_LENGTH);
    if (textInput !== undefined) draft.textInput = textInput;

    const replyToId = value['replyToId'];
    if (
      typeof replyToId === 'string' &&
      replyToId !== '' &&
      replyToId.length <= MAX_ROOM_ID_LENGTH
    ) {
      draft.replyToId = replyToId;
    }

    const originalText = this.boundedText(value['originalText'], MAX_CORRECTION_TEXT_LENGTH);
    if (originalText !== undefined) draft.originalText = originalText;
    const correctedText = this.boundedText(value['correctedText'], MAX_CORRECTION_TEXT_LENGTH);
    if (correctedText !== undefined) draft.correctedText = correctedText;
    const explanationText = this.boundedText(value['explanationText'], MAX_CORRECTION_TEXT_LENGTH);
    if (explanationText !== undefined) draft.explanationText = explanationText;

    return Object.keys(draft).length > 0 ? draft : null;
  }

  private readChatDraft(roomId: string): ChatDraft | null {
    const key = this.chatV2Key(roomId);
    if (!key) return null;

    const record = this.readRecord(key);
    if (record) {
      if (this.isExpired(record, Date.now())) {
        this.clearChatDraftV2(roomId);
        return null;
      }
      const draft = this.parseChatDraft(record);
      if (draft) return draft;
      this.safeRemove(key);
    }

    return this.readLegacyChatDraft(roomId);
  }

  private readLegacyChatDraft(roomId: string): ChatDraft | null {
    const legacyKey = this.chatKey(roomId);
    if (!legacyKey) return null;

    const raw = this.safeGet(legacyKey);
    if (raw === null) return null;
    const textInput = this.boundedText(raw, MAX_CHAT_TEXT_LENGTH);
    if (textInput === undefined) {
      this.safeRemove(legacyKey);
      return null;
    }
    return { textInput };
  }

  /** Saves the whole draft for a room, replacing what was stored. An empty draft removes the record. */
  saveChatDraftV2(roomId: string, draft: ChatDraft): void {
    this.ensureSwept();
    const key = this.chatV2Key(roomId);
    if (!key) return;

    const safeDraft = this.parseChatDraft(draft);
    if (safeDraft) {
      this.writeRecord(key, safeDraft);
    } else {
      this.clearChatDraftV2(roomId);
    }
  }

  loadChatDraftV2(roomId: string): ChatDraft | null {
    this.ensureSwept();
    return this.readChatDraft(roomId);
  }

  /** Removes the room draft, including any raw-text copy left by an earlier version. */
  clearChatDraftV2(roomId: string): void {
    const key = this.chatV2Key(roomId);
    const legacyKey = this.chatKey(roomId);
    if (key) this.safeRemove(key);
    if (legacyKey) this.safeRemove(legacyKey);
  }

  // Text-only helpers for composers without reply or correction state. They share the room record
  // above, so retention and clearing behave identically.

  /** Updates only the message text, keeping any reply or correction state already stored. */
  saveChatDraft(roomId: string, text: string): void {
    this.ensureSwept();
    this.saveChatDraftV2(roomId, { ...this.readChatDraft(roomId), textInput: text });
  }

  loadChatDraft(roomId: string): string {
    this.ensureSwept();
    return this.readChatDraft(roomId)?.textInput ?? '';
  }

  clearChatDraft(roomId: string): void {
    this.clearChatDraftV2(roomId);
  }

  // ---- Moment drafts ----

  private parseMomentDraft(value: unknown): MomentDraft | null {
    if (!isRecord(value)) return null;

    const draft: MomentDraft = {};
    const text = this.boundedText(value['text'], MAX_MOMENT_TEXT_LENGTH);
    if (text !== undefined) draft.text = text;

    const rawMediaUrls = value['mediaUrls'];
    if (Array.isArray(rawMediaUrls)) {
      const mediaUrls = rawMediaUrls
        .filter((url): url is string => this.validMediaUrl(url))
        .slice(0, MAX_MEDIA_URLS);
      if (mediaUrls.length > 0) draft.mediaUrls = mediaUrls;
    }

    const mediaType = value['mediaType'];
    if (mediaType === 'none' || mediaType === 'images' || mediaType === 'audio') {
      draft.mediaType = mediaType;
    }

    const targetLanguage = this.boundedText(value['targetLanguage'], MAX_LANGUAGE_CODE_LENGTH);
    if (targetLanguage !== undefined) draft.targetLanguage = targetLanguage;

    const voiceDurationSec = value['voiceDurationSec'];
    if (
      typeof voiceDurationSec === 'number' &&
      Number.isFinite(voiceDurationSec) &&
      voiceDurationSec >= 0 &&
      voiceDurationSec <= MAX_MOMENT_VOICE_SECONDS
    ) {
      draft.voiceDurationSec = voiceDurationSec;
    }

    // Settings on their own (language, media type) are not worth restoring.
    return draft.text !== undefined || draft.mediaUrls !== undefined ? draft : null;
  }

  saveMomentDraft(draft: MomentDraft): void {
    this.ensureSwept();
    const safeDraft = this.parseMomentDraft(draft);
    if (safeDraft) {
      this.writeRecord(this.momentKey(), safeDraft);
    } else {
      this.clearMomentDraft();
    }
  }

  loadMomentDraft(): MomentDraft | null {
    this.ensureSwept();
    const key = this.momentKey();
    const record = this.readRecord(key);
    if (!record) return null;

    const draft = this.isExpired(record, Date.now()) ? null : this.parseMomentDraft(record);
    if (!draft) this.safeRemove(key);
    return draft;
  }

  clearMomentDraft(): void {
    this.safeRemove(this.momentKey());
  }
}
