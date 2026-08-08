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

@Injectable({ providedIn: 'root' })
export class DraftService {
  private readonly authService = inject(AuthService);

  private isAvailable(): boolean {
    return typeof localStorage !== 'undefined';
  }

  private getUserSuffix(): string {
    const userId = this.authService.currentUser()?.id;
    return userId ? `_${userId}` : '_anon';
  }

  private chatKey(roomId: string): string {
    return `hellotalk_chat_draft_${roomId}${this.getUserSuffix()}`;
  }

  private chatV2Key(roomId: string): string {
    return `hellotalk_chat_draft_v2_${roomId}${this.getUserSuffix()}`;
  }

  private momentKey(): string {
    return `hellotalk_moment_draft${this.getUserSuffix()}`;
  }

  // ---- Chat drafts (legacy: text only) ----

  saveChatDraft(roomId: string, text: string): void {
    if (!this.isAvailable()) return;
    if (text.trim()) {
      localStorage.setItem(this.chatKey(roomId), text);
    } else {
      this.clearChatDraft(roomId);
    }
  }

  loadChatDraft(roomId: string): string {
    if (!this.isAvailable()) return '';
    return localStorage.getItem(this.chatKey(roomId)) ?? '';
  }

  clearChatDraft(roomId: string): void {
    if (!this.isAvailable()) return;
    localStorage.removeItem(this.chatKey(roomId));
  }

  // ---- Chat drafts (v2: enriched with reply/correction state) ----

  saveChatDraftV2(roomId: string, draft: ChatDraft): void {
    if (!this.isAvailable()) return;
    const hasContent =
      (draft.textInput && draft.textInput.trim()) ||
      (draft.originalText && draft.originalText.trim()) ||
      (draft.correctedText && draft.correctedText.trim()) ||
      (draft.explanationText && draft.explanationText.trim()) ||
      draft.replyToId;

    if (hasContent) {
      localStorage.setItem(this.chatV2Key(roomId), JSON.stringify(draft));
    } else {
      this.clearChatDraftV2(roomId);
    }
  }

  loadChatDraftV2(roomId: string): ChatDraft | null {
    if (!this.isAvailable()) return null;
    const raw = localStorage.getItem(this.chatV2Key(roomId));
    if (!raw) return null;
    try {
      const d: Record<string, unknown> = JSON.parse(raw);
      if (!d || typeof d !== 'object') return null;
      const result: ChatDraft = {};
      let hasValid = false;

      if (typeof d['textInput'] === 'string') { result.textInput = d['textInput']; hasValid = true; }
      if (d['replyToId'] === null || typeof d['replyToId'] === 'string') { result.replyToId = d['replyToId']; }
      if (typeof d['originalText'] === 'string') { result.originalText = d['originalText']; hasValid = true; }
      if (typeof d['correctedText'] === 'string') { result.correctedText = d['correctedText']; hasValid = true; }
      if (typeof d['explanationText'] === 'string') { result.explanationText = d['explanationText']; hasValid = true; }

      return hasValid ? result : null;
    } catch {
      return null;
    }
  }

  clearChatDraftV2(roomId: string): void {
    if (!this.isAvailable()) return;
    localStorage.removeItem(this.chatV2Key(roomId));
  }

  // ---- Moment drafts ----

  saveMomentDraft(draft: MomentDraft): void {
    if (!this.isAvailable()) return;
    const hasContent =
      (draft.text && draft.text.trim()) ||
      (draft.mediaUrls && draft.mediaUrls.length > 0);

    if (hasContent) {
      localStorage.setItem(this.momentKey(), JSON.stringify(draft));
    } else {
      this.clearMomentDraft();
    }
  }

  loadMomentDraft(): MomentDraft | null {
    if (!this.isAvailable()) return null;
    const raw = localStorage.getItem(this.momentKey());
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return null;
      const d = parsed as Record<string, unknown>;
      const result: MomentDraft = {};
      let hasValidField = false;

      if (typeof d['text'] === 'string') { result.text = d['text']; hasValidField = true; }
      if (Array.isArray(d['mediaUrls'])) {
        result.mediaUrls = (d['mediaUrls'] as unknown[]).filter((u): u is string => typeof u === 'string');
        if (result.mediaUrls.length > 0) hasValidField = true;
      }
      if (d['mediaType'] === 'none' || d['mediaType'] === 'images' || d['mediaType'] === 'audio') {
        result.mediaType = d['mediaType'];
        hasValidField = true;
      }
      if (typeof d['targetLanguage'] === 'string') { result.targetLanguage = d['targetLanguage']; hasValidField = true; }
      if (typeof d['voiceDurationSec'] === 'number' || d['voiceDurationSec'] === null) {
        result.voiceDurationSec = d['voiceDurationSec'];
        hasValidField = true;
      }

      return hasValidField ? result : null;
    } catch {
      return null;
    }
  }

  clearMomentDraft(): void {
    if (!this.isAvailable()) return;
    localStorage.removeItem(this.momentKey());
  }
}