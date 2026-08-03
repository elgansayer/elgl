import { Component, inject, input, signal, DestroyRef } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-text-to-speech',
  imports: [TranslatePipe],
  template: `
    <button
      type="button"
      (click)="toggleSpeech()"
      class="inline-flex items-center gap-1 ps-2.5 pe-2.5 py-1 rounded-xl text-xs font-bold transition-all"
      [class.bg-primary]="isSpeaking()"
      [class.text-white]="isSpeaking()"
      [class.animate-pulse]="isSpeaking()"
      [class.bg-surface-100]="!isSpeaking()"
      [class.text-text-primary]="!isSpeaking()"
      [attr.aria-label]="isSpeaking() ? ('moments.stopReading' | t) : ('moments.readAloud' | t)"
      [attr.aria-pressed]="isSpeaking()"
    >
      <span aria-hidden="true">{{ isSpeaking() ? '⏹️' : '🔊' }}</span>
      <span>{{ isSpeaking() ? ('moments.stopReading' | t) : ('moments.readAloud' | t) }}</span>
    </button>
  `,
})
export class TextToSpeechComponent {
  readonly text = input.required<string>();
  readonly language = input<string>('en-GB');

  readonly isSpeaking = signal<boolean>(false);

  private utterance: SpeechSynthesisUtterance | null = null;
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.destroyRef.onDestroy(() => this.stopSpeaking());
  }

  toggleSpeech(): void {
    if (this.isSpeaking()) {
      this.stopSpeaking();
    } else {
      this.startSpeaking();
    }
  }

  private startSpeaking(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    const text = this.text();
    if (!text.trim()) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.language();
    utterance.rate = 0.9;
    utterance.onstart = () => this.isSpeaking.set(true);
    utterance.onend = () => this.isSpeaking.set(false);
    utterance.onerror = () => this.isSpeaking.set(false);
    window.speechSynthesis.speak(utterance);
    this.utterance = utterance;
  }

  private stopSpeaking(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking.set(false);
    this.utterance = null;
  }
}
