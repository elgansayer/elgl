import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

export interface MomentDraft {
  text?: string;
  mediaUrls?: string[];
  mediaType?: 'none' | 'images' | 'audio';
  targetLanguage?: string;
}

const CHAT_DRAFT_PREFIX = 'draft_chat_';
const MOMENT_DRAFT_KEY = 'draft_moment';

@Injectable({ providedIn: 'root' })
export class DraftService {
  private readonly authService = inject(AuthService);

  private isAvailable(): boolean {
    return typeof localStorage !== 'undefined';
  }

  private getUserPrefix(): string {
    const userId = this.authService.currentUser()?.id;
    return userId ? `ht_${userId}` : 'ht_anon';
  }

  private chatKey(roomId: string): string {
    return `${this.getUserPrefix()}_${CHAT_DRAFT_PREFIX}${roomId}`;
  }

  private momentKey(): string {
    return `${this.getUserPrefix()}_${MOMENT_DRAFT_KEY}`;
  }

  // ---- Chat drafts ----

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
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return null;
      const d: Record<string, unknown> = parsed;
      const result: MomentDraft = {};
      let hasValidField = false;

      if (typeof d.text === 'string') { result.text = d.text; hasValidField = true; }
      if (Array.isArray(d.mediaUrls)) {
        result.mediaUrls = d.mediaUrls.filter((u): u is string => typeof u === 'string');
        if (result.mediaUrls.length > 0) hasValidField = true;
      }
      if (d.mediaType === 'none' || d.mediaType === 'images' || d.mediaType === 'audio') {
        result.mediaType = d.mediaType;
        hasValidField = true;
      }
      if (typeof d.targetLanguage === 'string') { result.targetLanguage = d.targetLanguage; hasValidField = true; }

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