import { Injectable, inject, signal, effect, computed } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type FontScale = number;
export type TextSizePreference = 'small' | 'normal' | 'large';
export type ChatTextSizePreference = 'small' | 'medium' | 'large';

const DEFAULT_SCALE = 1.0;
const MIN_SCALE = 0.8;
const MAX_SCALE = 1.5;
const STEP = 0.05;
const STORAGE_KEY = 'app_font_scale';
const CHAT_TEXT_SIZE_STORAGE_KEY = 'app_chat_text_size';
const TEXT_SIZE_SCALES: Record<TextSizePreference, FontScale> = {
  small: 0.9,
  normal: 1,
  large: 1.15,
};
const CHAT_TEXT_SIZE_REM: Record<ChatTextSizePreference, string> = {
  small: '0.8125rem',
  medium: '0.875rem',
  large: '1rem',
};

function isScale(value: unknown): value is FontScale {
  return typeof value === 'number' && value >= MIN_SCALE && value <= MAX_SCALE;
}

function isChatTextSize(value: unknown): value is ChatTextSizePreference {
  return value === 'small' || value === 'medium' || value === 'large';
}

@Injectable({
  providedIn: 'root',
})
export class FontScaleService {
  readonly scaleFactor = signal<FontScale>(this.loadInitialScale());
  readonly chatTextSize = signal<ChatTextSizePreference>(this.loadInitialChatTextSize());
  readonly min = MIN_SCALE;
  readonly max = MAX_SCALE;
  readonly step = STEP;
  readonly textSizePreference = computed<TextSizePreference>(() => {
    const scale = this.scaleFactor();
    if (scale < 0.975) return 'small';
    if (scale > 1.075) return 'large';
    return 'normal';
  });

  private document = inject(DOCUMENT);

  constructor() {
    effect(() => {
      const scale = this.scaleFactor();
      this.applyScale(scale);
      this.saveToStorage(scale);
    });

    effect(() => {
      const chatTextSize = this.chatTextSize();
      this.applyChatTextSize(chatTextSize);
      this.saveChatTextSizeToStorage(chatTextSize);
    });
  }

  setScale(next: number): void {
    if (!Number.isFinite(next)) return;

    const stepCount = Math.round((next - MIN_SCALE) / STEP);
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, MIN_SCALE + stepCount * STEP));
    const rounded = Math.round(clamped * 100) / 100;
    this.scaleFactor.set(rounded);
  }

  setTextSizePreference(size: TextSizePreference): void {
    this.setScale(TEXT_SIZE_SCALES[size]);
  }

  setChatTextSize(size: ChatTextSizePreference): void {
    if (!isChatTextSize(size)) return;
    this.chatTextSize.set(size);
  }

  reset(): void {
    this.setScale(DEFAULT_SCALE);
  }

  private loadInitialScale(): FontScale {
    try {
      if (typeof localStorage === 'undefined') return DEFAULT_SCALE;

      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw !== null ? Number.parseFloat(raw) : Number.NaN;
      if (isScale(parsed)) return parsed;
      if (!Number.isNaN(parsed) && parsed >= MIN_SCALE * 100 && parsed <= MAX_SCALE * 100) {
        return parsed / 100;
      }
      return DEFAULT_SCALE;
    } catch {
      return DEFAULT_SCALE;
    }
  }

  private loadInitialChatTextSize(): ChatTextSizePreference {
    try {
      if (typeof localStorage === 'undefined') return 'medium';
      const stored = localStorage.getItem(CHAT_TEXT_SIZE_STORAGE_KEY);
      return isChatTextSize(stored) ? stored : 'medium';
    } catch {
      return 'medium';
    }
  }

  private saveToStorage(scale: FontScale): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, String(Math.round(scale * 100)));
      }
    } catch {
      // Font scaling must keep working in memory when storage is blocked or full.
    }
  }

  private saveChatTextSizeToStorage(size: ChatTextSizePreference): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CHAT_TEXT_SIZE_STORAGE_KEY, size);
      }
    } catch {
      // Chat text sizing must keep working in memory when storage is blocked or full.
    }
  }

  private applyScale(scale: FontScale): void {
    if (!this.document) return;
    const root = this.document.documentElement;
    if (!root) return;
    const baseRem = 16 * scale;
    root.style.fontSize = `${baseRem}px`;
    root.style.setProperty('--app-base-font-size', `${baseRem}px`);
  }

  private applyChatTextSize(size: ChatTextSizePreference): void {
    if (!this.document) return;
    const root = this.document.documentElement;
    if (!root) return;
    root.style.setProperty('--chat-message-font-size', CHAT_TEXT_SIZE_REM[size]);
  }
}
