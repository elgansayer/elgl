import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PronunciationService, PronunciationFeedback } from '../../services/pronunciation.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-pronunciation-feedback',
  imports: [FormsModule, TranslatePipe],
  template: `
    <div class="max-w-lg mx-auto p-6 space-y-6">
      <h2 class="text-2xl font-bold">{{ 'pronunciation.title' | t }}</h2>

      <div>
        <label class="block text-sm font-medium mb-1">
          {{ 'pronunciation.sentence_label' | t }}
          <input
            [(ngModel)]="sentence"
            class="w-full rounded-lg border border-slate-600 bg-surface-800 ps-3 pe-3 py-2 text-base outline-none"
            placeholder="{{ 'pronunciation.sentence_placeholder' | t }}"
          />
        </label>
      </div>

      <button
        [disabled]="isRecording()"
        (click)="startRecording()"
        class="inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-2 text-sm font-semibold shadow hover:bg-indigo-500"
      >
        @if (isRecording()) {
          {{ 'pronunciation.recording' | t }}
        } @else {
          {{ 'pronunciation.start' | t }}
        }
      </button>

      @if (isRecording()) {
        <button
          (click)="stopRecording()"
          class="inline-flex items-center justify-center rounded-full bg-red-600 px-6 py-2 text-sm font-semibold shadow hover:bg-red-500"
        >
          {{ 'pronunciation.stop' | t }}
        </button>
      }

      @if (feedback(); as fb) {
        <div class="mt-6 rounded-2xl bg-surface-700 p-5 space-y-3">
          <p class="text-lg font-bold">
            {{ 'pronunciation.score' | t }}: {{ fb.score }}%
          </p>
          <p>{{ fb.overallAssessment }}</p>
          @if (fb.phonemeBreakdown.length) {
            <details>
              <summary class="cursor-pointer text-sm text-indigo-400">
                {{ 'pronunciation.phonemes' | t }}
              </summary>
              <ul class="mt-2 space-y-1 text-sm">
                @for (ph of fb.phonemeBreakdown; track $index) {
                  <li class="font-mono">{{ ph }}</li>
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

  readonly sentence = signal<string>('');
  readonly isRecording = signal(false);
  readonly feedback = signal<PronunciationFeedback | null>(null);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  async startRecording(): Promise<void> {
    this.feedback.set(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      // fallback: cannot record
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream);
    this.audioChunks = [];
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };
    this.mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
    };
    this.mediaRecorder.start();
    this.isRecording.set(true);
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.isRecording.set(false);

    // Give time for data to accumulate
    setTimeout(() => {
      if (this.audioChunks.length === 0) return;
      const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
      this.sendForAnalysis(blob);
    }, 200);
  }

  private sendForAnalysis(blob: Blob): void {
    const ref = this.sentence().trim();
    this.pronunciationService.analyse(blob, ref || undefined).subscribe({
      next: (result) => {
        this.feedback.set(result);
      },
      error: () => {
        // show error toast
        this.feedback.set(null);
      },
    });
  }
}
