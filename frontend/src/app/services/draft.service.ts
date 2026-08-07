import { Injectable } from '@angular/core';

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
  private isAvailable(): boolean {
    return typeof localStorage !== 'undefined';
  }

  // ---- Chat drafts ----

  saveChatDraft(roomId: string, text: string): void {
    if (!this.isAvailable()) return;
    if (text.trim()) {
      localStorage.setItem(`${CHAT_DRAFT_PREFIX}${roomId}`, text);
    } else {
      this.clearChatDraft(roomId);
    }
  }

  loadChatDraft(roomId: string): string {
    if (!this.isAvailable()) return '';
    return localStorage.getItem(`${CHAT_DRAFT_PREFIX}${roomId}`) ?? '';
  }

  clearChatDraft(roomId: string): void {
    if (!this.isAvailable()) return;
    localStorage.removeItem(`${CHAT_DRAFT_PREFIX}${roomId}`);
  }

  // ---- Moment drafts ----

  saveMomentDraft(draft: MomentDraft): void {
    if (!this.isAvailable()) return;
    const hasContent =
      (draft.text && draft.text.trim()) ||
      (draft.mediaUrls && draft.mediaUrls.length > 0);

    if (hasContent) {
      localStorage.setItem(MOMENT_DRAFT_KEY, JSON.stringify(draft));
    } else {
      this.clearMomentDraft();
    }
  }

  loadMomentDraft(): MomentDraft | null {
    if (!this.isAvailable()) return null;
    const raw = localStorage.getItem(MOMENT_DRAFT_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as MomentDraft;
    } catch {
      return null;
    }
  }

  clearMomentDraft(): void {
    if (!this.isAvailable()) return;
    localStorage.removeItem(MOMENT_DRAFT_KEY);
  }
}