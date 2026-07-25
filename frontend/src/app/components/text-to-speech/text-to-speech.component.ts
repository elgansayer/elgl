import { showToast, notImplementedToast } from '../../services/toast.service';
import { Component, Input, signal } from '@angular/core';

@Component({
  selector: 'app-text-to-speech',
  imports: [],
  template: `
    <button
      (click)="speak($event)"
      [disabled]="isPlaying()"
      [class]="
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all ' +
        (isPlaying()
          ? 'bg-primary text-white animate-pulse'
          : 'bg-surface-100 hover:bg-surface-100 text-text-primary')
      "
      [title]="'Listen to native pronunciation of this text (' + language + ')'"
    >
      <span>{{ isPlaying() ? '🔊 Speaking...' : '🔊 Listen' }}</span>
    </button>
  `,
})
export class TextToSpeechComponent {
  @Input({ required: true }) text = '';
  @Input() language = 'en';

  readonly isPlaying = signal<boolean>(false);

  speak(event: Event): void {
    event.stopPropagation();
    if (!this.text.trim()) return;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop prior speeches
      const utterance = new SpeechSynthesisUtterance(this.text);
      utterance.lang = this.language;
      utterance.rate = 0.9; // Slightly slower for language learners

      utterance.onstart = () => this.isPlaying.set(true);
      utterance.onend = () => this.isPlaying.set(false);
      utterance.onerror = () => this.isPlaying.set(false);

      window.speechSynthesis.speak(utterance);
    } else {
      showToast('Text-to-speech is not supported in this browser environment.');
    }
  }
}
