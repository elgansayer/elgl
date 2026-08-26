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

const CHAT_DRAFT_PREFIX = 'draft_chat_';
const CHAT_DRAFT_V2_PREFIX = 'draft_chat_v2_';
const MOMENT_DRAFT_KEY = 'draft_moment';

const MAX_ROOM_ID_LENGTH = 160;
const MAX_CHAT_TEXT_LENGTH = 10_000;
const MAX_CORRECTION_TEXT_LENGTH = 10_000;
const MAX_MOMENT_TEXT_LENGTH = 10_000;
const MAX_MEDIA_URLS = 9;
const MAX_MEDIA_URL_LENGTH = 4_096;
const MAX_LANGUAGE_CODE_LENGTH = 32;
const MAX_SERIALIZED_DRAFT_LENGTH = 96_000;
const MAX_MOMENT_VOICE_SECONDS = 60;

@Injectable({ providedIn: 'root' })
export class DraftService {
  private readonly authService = inject(AuthService);

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

  private safeSet(key: string, value: string): void {
    if (value.length > MAX_SERIALIZED_DRAFT_LENGTH) return;
    try {
      this.storage()?.setItem(key, value);
    } catch {
      // Draft persistence is best-effort. Quota/security failures must never
      // prevent composing or sending a message/Moment.
    }
  }

  private safeRemove(key: string): void {
    try {
      this.storage()?.removeItem(key);
    } catch {
      // A storage failure must not break the primary messaging flow.
    }
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

  private boundedString(value: unknown, maxLength: number): string | undefined {
    return typeof value === 'string' && value.length <= maxLength ? value : undefined;
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

  // ---- Chat drafts (legacy: text only) ----

  saveChatDraft(roomId: string, text: string): void {
    const key = this.chatKey(roomId);
    if (!key) return;

    if (text.trim() && text.length <= MAX_CHAT_TEXT_LENGTH) {
      this.safeSet(key, text);
    } else {
      this.safeRemove(key);
    }
  }

  loadChatDraft(roomId: string): string {
    const key = this.chatKey(roomId);
    if (!key) return '';

    const raw = this.safeGet(key);
    if (!raw) return '';
    if (raw.length > MAX_CHAT_TEXT_LENGTH) {
      this.safeRemove(key);
      return '';
    }
    return raw;
  }

  clearChatDraft(roomId: string): void {
    const key = this.chatKey(roomId);
    if (key) this.safeRemove(key);
  }

  // ---- Chat drafts (v2: enriched with reply/correction state) ----

  saveChatDraftV2(roomId: string, draft: ChatDraft): void {
    const key = this.chatV2Key(roomId);
    if (!key) return;

    const safeDraft: ChatDraft = {
      textInput: this.boundedString(draft.textInput, MAX_CHAT_TEXT_LENGTH),
      replyToId:
        draft.replyToId === null ||
        (typeof draft.replyToId === 'string' && draft.replyToId.length <= MAX_ROOM_ID_LENGTH)
          ? draft.replyToId
          : undefined,
      originalText: this.boundedString(draft.originalText, MAX_CORRECTION_TEXT_LENGTH),
      correctedText: this.boundedString(draft.correctedText, MAX_CORRECTION_TEXT_LENGTH),
      explanationText: this.boundedString(draft.explanationText, MAX_CORRECTION_TEXT_LENGTH),
    };

    const hasContent =
      safeDraft.textInput?.trim() ||
      safeDraft.originalText?.trim() ||
      safeDraft.correctedText?.trim() ||
      safeDraft.explanationText?.trim() ||
      safeDraft.replyToId;

    if (hasContent) {
      this.safeSet(key, JSON.stringify(safeDraft));
    } else {
      this.safeRemove(key);
    }
  }

  loadChatDraftV2(roomId: string): ChatDraft | null {
    const key = this.chatV2Key(roomId);
    if (!key) return null;

    const raw = this.safeGet(key);
    if (!raw) return null;
    if (raw.length > MAX_SERIALIZED_DRAFT_LENGTH) {
      this.safeRemove(key);
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        this.safeRemove(key);
        return null;
      }

      const d = parsed as Record<string, unknown>;
      const result: ChatDraft = {};
      let hasValid = false;

      const textInput = this.boundedString(d['textInput'], MAX_CHAT_TEXT_LENGTH);
      if (textInput !== undefined) {
        result.textInput = textInput;
        hasValid = true;
      }

      if (
        d['replyToId'] === null ||
        (typeof d['replyToId'] === 'string' && d['replyToId'].length <= MAX_ROOM_ID_LENGTH)
      ) {
        result.replyToId = d['replyToId'] as string | null;
        hasValid = true;
      }

      const originalText = this.boundedString(d['originalText'], MAX_CORRECTION_TEXT_LENGTH);
      if (originalText !== undefined) {
        result.originalText = originalText;
        hasValid = true;
      }

      const correctedText = this.boundedString(d['correctedText'], MAX_CORRECTION_TEXT_LENGTH);
      if (correctedText !== undefined) {
        result.correctedText = correctedText;
        hasValid = true;
      }

      const explanationText = this.boundedString(d['explanationText'], MAX_CORRECTION_TEXT_LENGTH);
      if (explanationText !== undefined) {
        result.explanationText = explanationText;
        hasValid = true;
      }

      if (!hasValid) this.safeRemove(key);
      return hasValid ? result : null;
    } catch {
      this.safeRemove(key);
      return null;
    }
  }

  clearChatDraftV2(roomId: string): void {
    const key = this.chatV2Key(roomId);
    if (key) this.safeRemove(key);
  }

  // ---- Moment drafts ----

  saveMomentDraft(draft: MomentDraft): void {
    const text = this.boundedString(draft.text, MAX_MOMENT_TEXT_LENGTH);
    const mediaUrls = Array.isArray(draft.mediaUrls)
      ? draft.mediaUrls.filter((url) => this.validMediaUrl(url)).slice(0, MAX_MEDIA_URLS)
      : undefined;
    const mediaType =
      draft.mediaType === 'none' || draft.mediaType === 'images' || draft.mediaType === 'audio'
        ? draft.mediaType
        : undefined;
    const targetLanguage = this.boundedString(draft.targetLanguage, MAX_LANGUAGE_CODE_LENGTH);
    const voiceDurationSec =
      draft.voiceDurationSec === null ||
      (typeof draft.voiceDurationSec === 'number' &&
        Number.isFinite(draft.voiceDurationSec) &&
        draft.voiceDurationSec >= 0 &&
        draft.voiceDurationSec <= MAX_MOMENT_VOICE_SECONDS)
        ? draft.voiceDurationSec
        : undefined;

    const safeDraft: MomentDraft = {
      text,
      mediaUrls: mediaUrls?.length ? mediaUrls : undefined,
      mediaType,
      targetLanguage,
      voiceDurationSec,
    };

    const hasContent = safeDraft.text?.trim() || (safeDraft.mediaUrls?.length ?? 0) > 0;

    if (hasContent) {
      this.safeSet(this.momentKey(), JSON.stringify(safeDraft));
    } else {
      this.clearMomentDraft();
    }
  }

  loadMomentDraft(): MomentDraft | null {
    const key = this.momentKey();
    const raw = this.safeGet(key);
    if (!raw) return null;
    if (raw.length > MAX_SERIALIZED_DRAFT_LENGTH) {
      this.safeRemove(key);
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        this.safeRemove(key);
        return null;
      }

      const d = parsed as Record<string, unknown>;
      const result: MomentDraft = {};
      let hasValidField = false;

      const text = this.boundedString(d['text'], MAX_MOMENT_TEXT_LENGTH);
      if (text !== undefined) {
        result.text = text;
        hasValidField = true;
      }

      if (Array.isArray(d['mediaUrls'])) {
        const mediaUrls = d['mediaUrls']
          .filter((url) => this.validMediaUrl(url))
          .slice(0, MAX_MEDIA_URLS);
        if (mediaUrls.length > 0) {
          result.mediaUrls = mediaUrls;
          hasValidField = true;
        }
      }

      if (d['mediaType'] === 'none' || d['mediaType'] === 'images' || d['mediaType'] === 'audio') {
        result.mediaType = d['mediaType'];
        hasValidField = true;
      }

      const targetLanguage = this.boundedString(d['targetLanguage'], MAX_LANGUAGE_CODE_LENGTH);
      if (targetLanguage !== undefined) {
        result.targetLanguage = targetLanguage;
        hasValidField = true;
      }

      if (
        d['voiceDurationSec'] === null ||
        (typeof d['voiceDurationSec'] === 'number' &&
          Number.isFinite(d['voiceDurationSec']) &&
          d['voiceDurationSec'] >= 0 &&
          d['voiceDurationSec'] <= MAX_MOMENT_VOICE_SECONDS)
      ) {
        result.voiceDurationSec = d['voiceDurationSec'] as number | null;
        hasValidField = true;
      }

      const hasContent = result.text?.trim() || (result.mediaUrls?.length ?? 0) > 0;
      if (!hasValidField || !hasContent) {
        this.safeRemove(key);
        return null;
      }

      return result;
    } catch {
      this.safeRemove(key);
      return null;
    }
  }

  clearMomentDraft(): void {
    this.safeRemove(this.momentKey());
  }
}
