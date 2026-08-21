import { Injectable, inject, signal } from '@angular/core';

import { I18nService } from './i18n.service';
import { showToast } from './toast.service';

@Injectable({
  providedIn: 'root',
})
export class TextToSpeechService {
  private readonly i18n = inject(I18nService);

  readonly speakingId = signal<string | null>(null);

  get isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  isSpeaking(id: string): boolean {
    return this.speakingId() === id;
  }

  speak(id: string, text: string, lang = 'en-GB'): void {
    if (!text.trim()) return;

    if (!this.isSupported) {
      showToast(this.i18n.translate('tts.unsupported'));
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;
    utterance.onstart = () => this.speakingId.set(id);
    utterance.onend = () => this.clearIfCurrent(id);
    utterance.onerror = () => this.clearIfCurrent(id);

    window.speechSynthesis.speak(utterance);
  }

  stop(): void {
    if (this.isSupported) {
      window.speechSynthesis.cancel();
    }
    this.speakingId.set(null);
  }

  toggle(id: string, text: string, lang?: string): void {
    if (this.isSpeaking(id)) {
      this.stop();
    } else {
      this.speak(id, text, lang);
    }
  }

  private clearIfCurrent(id: string): void {
    if (this.speakingId() === id) {
      this.speakingId.set(null);
    }
  }
}
