import {
  Component,
  output,
  signal,
  inject,
  effect,
} from '@angular/core';
import { interval } from 'rxjs';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { MediaService } from '../../services/media.service';

@Component({
  selector: 'app-voice-recorder',
  imports: [TranslatePipe],
  templateUrl: './voice-recorder.component.html',
  styleUrls: ['./voice-recorder.component.scss'],
})
export class VoiceRecorderComponent {
  private mediaService = inject(MediaService);
  private i18n = inject(I18nService);

  audioUploaded = output<string>();
  cancelled = output<void>();

  readonly isRecording = signal(false);
  readonly isUploading = signal(false);
  readonly durationSeconds = signal(0);
  readonly audioPreviewUrl = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordedBlob: Blob | null = null;
  private audioStream: MediaStream | null = null;

  private timerEffect = effect(() => {
    if (!this.isRecording()) return;
    const sub = interval(1000).subscribe(() => {
      this.durationSeconds.update((s) => s + 1);
    });
    return () => sub.unsubscribe();
  });

  async startRecording(): Promise<void> {
    if (this.isRecording()) return;
    this.errorMessage.set(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioStream = stream;
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.recordedBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioPreviewUrl.set(URL.createObjectURL(this.recordedBlob));
        this.isRecording.set(false);
        stream.getTracks().forEach((track) => track.stop());
        this.audioStream = null;
      };

      this.mediaRecorder.start();
      this.isRecording.set(true);
      this.durationSeconds.set(0);
    } catch {
      this.errorMessage.set(this.i18n.translate('voiceRecorder.microphoneError'));
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  /*
   * Hold-to-record gesture handlers: start on pointerdown, stop on pointerup/pointerleave.
   * On mobile touchstart/touchend, browsers synthesise pointer events unless the page
   * calls preventDefault on touch events. The pointer events handle both mouse and touch.
   */
  onRecordPointerDown(event: PointerEvent): void {
    event.preventDefault();
    this.startRecording();
  }

  onRecordPointerUp(): void {
    if (this.isRecording()) {
      this.stopRecording();
    }
  }

  onRecordPointerLeave(): void {
    if (this.isRecording()) {
      this.stopRecording();
    }
  }

  async uploadAndSend(): Promise<void> {
    if (!this.recordedBlob) return;
    this.isUploading.set(true);
    this.errorMessage.set(null);

    try {
      const url = await this.mediaService.uploadVoiceNoteDirectToR2(this.recordedBlob);
      this.audioUploaded.emit(url);
    } catch {
      // Fallback: emit the local blob URL if R2 upload fails
      const fallback = this.audioPreviewUrl();
      if (fallback) {
        this.audioUploaded.emit(fallback);
      } else {
        this.errorMessage.set(this.i18n.translate('voiceRecorder.uploadError'));
      }
    } finally {
      this.isUploading.set(false);
    }
  }

  cancel(): void {
    if (this.isRecording()) {
      this.stopRecording();
    }
    const preview = this.audioPreviewUrl();
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    this.audioPreviewUrl.set(null);
    this.recordedBlob = null;
    this.cancelled.emit();
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
