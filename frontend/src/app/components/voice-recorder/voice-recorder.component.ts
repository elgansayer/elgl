import { HlmButton } from '@spartan-ng/helm/button';
import { showToast } from '../../services/toast.service';
import { Component, output, signal, inject, OnDestroy } from '@angular/core';

import { TranslatePipe } from '../../services/translate.pipe';

import { MediaService } from '../../services/media.service';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppChipComponent } from '../primitives/chip/chip.component';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';

@Component({
  selector: 'app-voice-recorder',
  imports: [
    HlmButton,
    TranslatePipe,
    AppCardComponent,
    AppChipComponent,
    AppButtonPrimaryComponent,
  ],
  templateUrl: './voice-recorder.component.html',
  styleUrls: ['./voice-recorder.component.scss'],
})
export class VoiceRecorderComponent implements OnDestroy {
  private mediaService = inject(MediaService);

  audioUploaded = output<string>();
  cancelled = output<void>();

  readonly isRecording = signal<boolean>(false);
  readonly isUploading = signal<boolean>(false);
  readonly durationSeconds = signal<number>(0);
  readonly audioPreviewUrl = signal<string | null>(null);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private recordedBlob: Blob | null = null;
  private audioStream: MediaStream | null = null;
  private isStarting = false;
  private activePress: 'pointer' | 'keyboard' | null = null;
  private activePointerId: number | null = null;
  private destroyed = false;

  async startRecording(): Promise<void> {
    if (this.isRecording() || this.isStarting || this.isUploading()) return;

    this.isStarting = true;
    this.clearPreview();
    this.durationSeconds.set(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (this.destroyed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      this.audioStream = stream;
      this.audioChunks = [];
      const recorder = new MediaRecorder(stream);
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || this.audioChunks[0]?.type || 'audio/webm';
        this.recordedBlob = new Blob(this.audioChunks, { type: mimeType });
        this.replacePreviewUrl(URL.createObjectURL(this.recordedBlob));
        stream.getTracks().forEach((track) => track.stop());
        this.audioStream = null;
        this.mediaRecorder = null;
      };

      recorder.start();
      this.isRecording.set(true);
      this.timerInterval = setInterval(() => {
        this.durationSeconds.update((seconds) => seconds + 1);
      }, 1000);
    } catch {
      console.warn('Voice recording could not start');
      showToast('Microphone permission required to record voice notes.');
    } finally {
      this.isStarting = false;
    }
  }

  async onRecordPointerDown(event: PointerEvent): Promise<void> {
    if (event.button !== 0 || this.activePress !== null) return;

    event.preventDefault();
    this.activePress = 'pointer';
    this.activePointerId = event.pointerId;
    const target = event.currentTarget;
    if (target instanceof Element) {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort; release handling still works without it.
      }
    }

    await this.startRecording();
    if (this.activePress !== 'pointer' || this.activePointerId !== event.pointerId) {
      this.stopRecording();
    }
  }

  onRecordPointerUp(event: PointerEvent): void {
    if (this.activePress !== 'pointer' || this.activePointerId !== event.pointerId) return;

    event.preventDefault();
    this.activePress = null;
    this.activePointerId = null;
    this.stopRecording();
  }

  onRecordPointerCancel(event: PointerEvent): void {
    this.onRecordPointerUp(event);
  }

  onRecordKeyDown(event: KeyboardEvent): void {
    if ((event.key !== ' ' && event.key !== 'Enter') || event.repeat || this.activePress !== null) {
      return;
    }

    event.preventDefault();
    this.activePress = 'keyboard';
    void this.startRecording().then(() => {
      if (this.activePress !== 'keyboard') {
        this.stopRecording();
      }
    });
  }

  onRecordKeyUp(event: KeyboardEvent): void {
    if ((event.key !== ' ' && event.key !== 'Enter') || this.activePress !== 'keyboard') return;

    event.preventDefault();
    this.activePress = null;
    this.stopRecording();
  }

  stopRecording(): void {
    this.clearTimer();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.isRecording.set(false);
  }

  async uploadAndSend(): Promise<void> {
    if (!this.recordedBlob || this.isUploading()) return;
    this.isUploading.set(true);

    try {
      const result = await this.mediaService.uploadVoiceNote(this.recordedBlob, 'ogg');
      if (!result.url) {
        throw new Error('Voice upload returned no URL');
      }
      this.audioUploaded.emit(result.url);
      this.clearPreview();
    } catch {
      console.warn('Voice note upload failed');
      showToast('Voice note upload failed. Please retry.');
    } finally {
      this.isUploading.set(false);
    }
  }

  cancel(): void {
    this.activePress = null;
    this.activePointerId = null;
    this.stopRecording();
    this.audioStream?.getTracks().forEach((track) => track.stop());
    this.audioStream = null;
    this.clearPreview();
    this.cancelled.emit();
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.activePress = null;
    this.activePointerId = null;
    this.clearTimer();

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;

    this.audioStream?.getTracks().forEach((track) => track.stop());
    this.audioStream = null;
    this.clearPreview();
  }

  private clearTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private replacePreviewUrl(url: string): void {
    const previous = this.audioPreviewUrl();
    if (previous) URL.revokeObjectURL(previous);
    this.audioPreviewUrl.set(url);
  }

  private clearPreview(): void {
    const previewUrl = this.audioPreviewUrl();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    this.audioPreviewUrl.set(null);
    this.recordedBlob = null;
  }
}
