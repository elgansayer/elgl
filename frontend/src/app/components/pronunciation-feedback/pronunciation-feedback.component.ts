import { Component, signal, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { PronunciationService, PronunciationFeedback } from '../../services/pronunciation.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-pronunciation-feedback',
  imports: [FormsModule, TranslatePipe, ...HlmButtonImports, ...HlmInputImports],
  template: `
    <div class="mx-auto max-w-lg space-y-6 p-6">
      <h2 class="text-2xl font-bold">{{ 'pronunciation.title' | t }}</h2>

      <label class="block text-sm font-medium">
        <span class="mb-1 block">{{ 'pronunciation.sentence_label' | t }}</span>
        <input
          hlmInput
          [(ngModel)]="sentence"
          [placeholder]="'pronunciation.sentence_placeholder' | t"
        />
      </label>

      <div class="flex flex-wrap gap-3">
        <button hlmBtn type="button" size="touch" [disabled]="isRecording()" (click)="startRecording()">
          {{ (isRecording() ? 'pronunciation.recording' : 'pronunciation.start') | t }}
        </button>

        @if (isRecording()) {
          <button hlmBtn type="button" variant="destructive-solid" size="touch" (click)="stopRecording()">
            {{ 'pronunciation.stop' | t }}
          </button>
        }
      </div>

      @if (feedback(); as fb) {
        <div class="mt-6 space-y-3 rounded-2xl bg-surface-700 p-5">
          <p class="text-lg font-bold">{{ 'pronunciation.score' | t }}: {{ fb.score }}%</p>
          <p>{{ fb.overallAssessment }}</p>
          @if (fb.phonemeBreakdown.length) {
            <details>
              <summary class="cursor-pointer text-sm text-primary">{{ 'pronunciation.phonemes' | t }}</summary>
              <ul class="mt-2 space-y-1 text-sm">
                @for (phoneme of fb.phonemeBreakdown; track $index) {
                  <li class="font-mono">{{ phoneme }}</li>
                }
              </ul>
            </details>
          }
        </div>
      }
    </div>
  `,
})
export class PronunciationFeedbackComponent {
  private pronunciationService = inject(PronunciationService);
  private destroyRef = inject(DestroyRef);

  readonly sentence = signal<string>('');
  readonly isRecording = signal(false);
  readonly feedback = signal<PronunciationFeedback | null>(null);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  async startRecording(): Promise<void> {
    this.feedback.set(null);
    if (!navigator.mediaDevices?.getUserMedia) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream);
    this.audioChunks = [];
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.audioChunks.push(event.data);
    };
    this.mediaRecorder.onstop = () => stream.getTracks().forEach((track) => track.stop());
    this.mediaRecorder.start();
    this.isRecording.set(true);
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') this.mediaRecorder.stop();
    this.isRecording.set(false);
    const timerId = window.setTimeout(() => {
      if (this.audioChunks.length === 0) return;
      this.sendForAnalysis(new Blob(this.audioChunks, { type: 'audio/webm' }));
    }, 200);
    this.destroyRef.onDestroy(() => clearTimeout(timerId));
  }

  private sendForAnalysis(blob: Blob): void {
    const reference = this.sentence().trim();
    this.pronunciationService
      .analyse(blob, reference || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => this.feedback.set(result),
        error: () => this.feedback.set(null),
      });
  }
}
