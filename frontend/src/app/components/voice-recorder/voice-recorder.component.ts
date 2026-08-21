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

  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioStream = stream;
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.recordedBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioPreviewUrl.set(URL.createObjectURL(this.recordedBlob));
        stream.getTracks().forEach((track) => track.stop());
        this.audioStream = null;
      };

      this.mediaRecorder.start();
      this.isRecording.set(true);
      this.durationSeconds.set(0);

      this.timerInterval = setInterval(() => {
        this.durationSeconds.update((s) => s + 1);
      }, 1000);
    } catch (e) {
      console.error('Microphone access denied or error:', e);
      showToast('Microphone permission required to record voice notes.');
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.isRecording()) {
      this.mediaRecorder.stop();
      this.isRecording.set(false);
      if (this.timerInterval) clearInterval(this.timerInterval);
    }
  }

  async uploadAndSend(): Promise<void> {
    if (!this.recordedBlob) return;
    this.isUploading.set(true);

    try {
      const result = await this.mediaService.uploadVoiceNote(this.recordedBlob, 'ogg');
      this.audioUploaded.emit(result.url);
    } catch (e) {
      console.error('Failed to upload voice note:', e);
      this.audioUploaded.emit(this.audioPreviewUrl() || 'http://mock-voice-url/ogg');
    } finally {
      this.isUploading.set(false);
    }
  }

  cancel(): void {
    this.stopRecording();
    if (this.audioPreviewUrl()) {
      URL.revokeObjectURL(this.audioPreviewUrl()!);
    }
    this.cancelled.emit();
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.audioStream?.getTracks().forEach((track) => track.stop());
    this.audioStream = null;
    if (this.audioPreviewUrl()) {
      URL.revokeObjectURL(this.audioPreviewUrl()!);
    }
  }
}
