import { Component, inject, input, computed, DestroyRef } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';
import { TextToSpeechService } from '../../services/text-to-speech.service';

let nextInstanceId = 0;

@Component({
  selector: 'app-text-to-speech',
  imports: [TranslatePipe, ...HlmButtonImports],
  template: `
    <button
      hlmBtn
      type="button"
      variant="secondary"
      size="sm"
      class="rounded-xl"
      (click)="toggleSpeech()"
      [class.bg-primary]="isSpeaking()"
      [class.text-on-fill]="isSpeaking()"
      [class.animate-pulse]="isSpeaking()"
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

  private readonly tts = inject(TextToSpeechService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly instanceId = `text-to-speech-${nextInstanceId++}`;

  readonly isSpeaking = computed(() => this.tts.isSpeaking(this.instanceId));

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.isSpeaking()) this.tts.stop();
    });
  }

  toggleSpeech(): void {
    this.tts.toggle(this.instanceId, this.text(), this.language());
  }
}
