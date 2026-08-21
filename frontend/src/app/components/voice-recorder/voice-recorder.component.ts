import { Component, OnDestroy, inject, output, signal } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';

import { MediaService } from '../../services/media.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppCardComponent } from '../primitives/card/card.component';

const MAX_RECORDING_SECONDS = 120;

type RecorderErrorKey = 'audioIntro.microphoneError' | 'audioIntro.uploadError';

@Component({
  selector: 'app-voice-recorder',
  imports: [HlmButton, TranslatePipe, AppCardComponent, AppButtonPrimaryComponent],
  templateUrl: './voice-recorder.component.html',
  styleUrls: ['./voice-recorder.component.scss'],
})
export class VoiceRecorderComponent implements OnDestroy {
  private readonly mediaService = inject(MediaService);

  readonly audioUploaded = output<string>();
  readonly cancelled = output<void>();

  readonly isPreparing = signal(false);
  readonly isRecording = signal(false);
  readonly isUploading = signal(false);
  readonly durationSeconds = signal(0);
  readonly audioPreviewUrl = signal<string | null>(null);
  readonly errorKey = signal<RecorderErrorKey | null>(null);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private recordedBlob: Blob | null = null;
  private audioStream: MediaStream | null = null;
  private holdActive = false;
  private suppressNextClick = false;
  private startGeneration = 0;
  private discardOnStop = false;
  private destroyed = false;

  onRecordPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || this.isUploading()) {
      return;
    }
    event.preventDefault();
    this.suppressNextClick = true;
    this.holdActive = true;
    const target = event.currentTarget as HTMLElement | null;
    target?.setPointerCapture?.(event.pointerId);
    void this.startRecording(true);
  }

  onRecordPointerUp(event: PointerEvent): void {
    event.preventDefault();
    this.endHoldRecording();
    const target = event.currentTarget as HTMLElement | null;
    if (target?.hasPointerCapture?.(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
  }

  onRecordPointerCancel(event: PointerEvent): void {
    this.onRecordPointerUp(event);
  }

  onRecordKeyDown(event: KeyboardEvent): void {
    if ((event.key !== ' ' && event.key !== 'Enter') || event.repeat || this.isUploading()) {
      return;
    }
    event.preventDefault();
    this.suppressNextClick = true;
    this.holdActive = true;
    void this.startRecording(true);
  }

  onRecordKeyUp(event: KeyboardEvent): void {
    if (event.key !== ' ' && event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    this.endHoldRecording();
  }

  onRecordClick(): void {
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }

    // Assistive technologies may activate a button with a synthetic click and
    // no pointer/key lifecycle. Keep that path usable as a start/stop toggle.
    if (this.isRecording() || this.isPreparing()) {
      this.endHoldRecording();
      return;
    }
    void this.startRecording(false);
  }

  async startRecording(requireHold = false): Promise<void> {
    if (this.isRecording() || this.isPreparing() || this.isUploading()) {
      return;
    }

    this.errorKey.set(null);
    this.resetPreview();
    this.recordedBlob = null;
    this.audioChunks = [];
    this.durationSeconds.set(0);
    this.discardOnStop = false;

    const generation = ++this.startGeneration;
    this.isPreparing.set(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Audio recording is unavailable');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (
        this.destroyed ||
        generation !== this.startGeneration ||
        (requireHold && !this.holdActive)
      ) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      this.audioStream = stream;
      const recorder = this.createRecorder(stream);
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const chunks = this.audioChunks;
        const contentType = recorder.mimeType || chunks[0]?.type || 'audio/webm';
        this.stopStream();
        this.mediaRecorder = null;

        if (this.discardOnStop || this.destroyed || chunks.length === 0) {
          this.audioChunks = [];
          return;
        }

        const blob = new Blob(chunks, { type: contentType });
        this.audioChunks = [];
        if (blob.size === 0) {
          return;
        }
        this.recordedBlob = blob;
        this.audioPreviewUrl.set(URL.createObjectURL(blob));
      };

      recorder.start();
      this.isRecording.set(true);
      this.startTimer();
    } catch {
      if (generation === this.startGeneration && !this.destroyed) {
        this.errorKey.set('audioIntro.microphoneError');
      }
      this.stopStream();
    } finally {
      if (generation === this.startGeneration) {
        this.isPreparing.set(false);
      }
    }
  }

  stopRecording(discard = false): void {
    this.holdActive = false;
    this.discardOnStop ||= discard;
    this.clearTimer();

    const recorder = this.mediaRecorder;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      this.stopStream();
    }
    this.isRecording.set(false);
  }

  async uploadAndSend(): Promise<void> {
    if (!this.recordedBlob || this.isUploading()) {
      return;
    }

    this.errorKey.set(null);
    this.isUploading.set(true);
    try {
      const result = await this.mediaService.uploadVoiceNote(this.recordedBlob);
      this.audioUploaded.emit(result.url);
    } catch {
      this.errorKey.set('audioIntro.uploadError');
    } finally {
      this.isUploading.set(false);
    }
  }

  cancel(): void {
    this.startGeneration += 1;
    this.isPreparing.set(false);
    this.stopRecording(true);
    this.resetPreview();
    this.recordedBlob = null;
    this.errorKey.set(null);
    this.cancelled.emit();
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.startGeneration += 1;
    this.isPreparing.set(false);
    this.stopRecording(true);
    this.resetPreview();
    this.recordedBlob = null;
  }

  private endHoldRecording(): void {
    this.holdActive = false;
    if (this.isPreparing()) {
      this.startGeneration += 1;
      this.isPreparing.set(false);
    }
    if (this.isRecording()) {
      this.stopRecording();
    }
  }

  private createRecorder(stream: MediaStream): MediaRecorder {
    const preferredType = 'audio/webm;codecs=opus';
    if (MediaRecorder.isTypeSupported?.(preferredType)) {
      return new MediaRecorder(stream, { mimeType: preferredType });
    }
    return new MediaRecorder(stream);
  }

  private startTimer(): void {
    this.clearTimer();
    this.timerInterval = setInterval(() => {
      const next = this.durationSeconds() + 1;
      this.durationSeconds.set(next);
      if (next >= MAX_RECORDING_SECONDS) {
        this.stopRecording();
      }
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private stopStream(): void {
    this.audioStream?.getTracks().forEach((track) => track.stop());
    this.audioStream = null;
  }

  private resetPreview(): void {
    const previewUrl = this.audioPreviewUrl();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      this.audioPreviewUrl.set(null);
    }
  }
}
