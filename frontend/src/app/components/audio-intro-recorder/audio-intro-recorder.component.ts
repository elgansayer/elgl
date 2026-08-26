import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-audio-intro-recorder',
  standalone: true,
  imports: [HlmButton, TranslatePipe],
  templateUrl: './audio-intro-recorder.component.html',
  styleUrls: ['./audio-intro-recorder.component.scss'],
})
export class AudioIntroRecorderComponent {
  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);

  readonly existingAudioUrl = input<string | null>(null);
  readonly recordingComplete = output<string>();

  readonly isRecording = signal(false);
  readonly isPlaying = signal(false);
  readonly isUploading = signal(false);
  readonly hasRecording = signal(false);
  readonly recordingBlob = signal<Blob | null>(null);
  readonly recordingUrl = signal('');
  readonly duration = signal(0);
  readonly recordError = signal<string | null>(null);
  readonly safeExistingAudioUrl = computed(() => this.toSafeHttpUrl(this.existingAudioUrl()));

  readonly maxDuration = 30;

  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private audioStream: MediaStream | null = null;
  private recordingTimer: ReturnType<typeof setInterval> | null = null;
  private previewAudio: HTMLAudioElement | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.cleanupRecording());
  }

  formatTime(seconds: number): string {
    const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  async startRecording(): Promise<void> {
    if (this.isRecording() || this.isUploading()) return;

    this.recordError.set(null);
    this.duration.set(0);
    this.clearRecordingTimer();
    this.stopPreviewAudio();

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('recording-unavailable');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioStream = stream;
      this.mediaRecorder = this.createMediaRecorder(stream);
      this.chunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.chunks.push(event.data);
      };
      this.mediaRecorder.onstop = () => this.finalizeRecording(stream);
      this.mediaRecorder.start();
      // Keep an existing unsaved recording until microphone access and the
      // replacement MediaRecorder have both started successfully. A denied
      // permission or unsupported recorder must remain retryable without
      // destroying the user's previous take.
      this.clearLocalRecording();
      this.isRecording.set(true);
      this.startRecordingTimer();
    } catch {
      this.stopAudioStream();
      this.mediaRecorder = null;
      this.isRecording.set(false);
      this.recordError.set('common.error_generic');
    }
  }

  stopRecording(): void {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return;
    this.clearRecordingTimer();
    this.mediaRecorder.stop();
  }

  async uploadRecording(): Promise<void> {
    const blob = this.recordingBlob();
    if (!blob || this.isUploading()) return;

    this.recordError.set(null);
    this.isUploading.set(true);
    try {
      const file = new File([blob], 'intro.webm', { type: blob.type || 'audio/webm' });
      const { uploadUrl, mediaUrl } = await this.userService.getPresignedUploadUrl(
        file.name,
        file.type,
        'audio-intro',
      );
      const safeUploadUrl = this.toSafeHttpUrl(uploadUrl);
      const safeMediaUrl = this.toSafeHttpUrl(mediaUrl);
      if (!safeUploadUrl || !safeMediaUrl) throw new Error('unsafe-upload-url');

      const response = await fetch(safeUploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': file.type },
      });
      if (!response.ok) throw new Error('upload-failed');

      await this.userService.updateMyProfile({ audio_intro_url: safeMediaUrl });
      this.recordingComplete.emit(safeMediaUrl);
      this.clearLocalRecording();
    } catch {
      // Keep the local recording so the user can retry without recording again.
      this.recordError.set('common.error_generic');
    } finally {
      this.isUploading.set(false);
    }
  }

  playPreview(): void {
    const localUrl = this.recordingUrl();
    if (!localUrl || this.isPlaying()) return;

    this.stopPreviewAudio();
    const audio = new Audio(localUrl);
    this.previewAudio = audio;
    audio.onended = () => {
      this.isPlaying.set(false);
      this.previewAudio = null;
    };
    audio.onerror = () => {
      this.isPlaying.set(false);
      this.previewAudio = null;
      this.recordError.set('common.error_generic');
    };
    void audio
      .play()
      .then(() => this.isPlaying.set(true))
      .catch(() => {
        this.isPlaying.set(false);
        this.previewAudio = null;
        this.recordError.set('common.error_generic');
      });
  }

  private createMediaRecorder(stream: MediaStream): MediaRecorder {
    const preferredMime = 'audio/webm;codecs=opus';
    if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(preferredMime)) {
      return new MediaRecorder(stream, { mimeType: preferredMime });
    }
    return new MediaRecorder(stream);
  }

  private startRecordingTimer(): void {
    this.clearRecordingTimer();
    this.recordingTimer = setInterval(() => {
      if (!this.isRecording()) {
        this.clearRecordingTimer();
        return;
      }
      const nextDuration = Math.min(this.duration() + 1, this.maxDuration);
      this.duration.set(nextDuration);
      if (nextDuration >= this.maxDuration) this.stopRecording();
    }, 1000);
  }

  private finalizeRecording(stream: MediaStream): void {
    this.clearRecordingTimer();
    stream.getTracks().forEach((track) => track.stop());
    if (this.audioStream === stream) this.audioStream = null;
    this.mediaRecorder = null;
    this.isRecording.set(false);

    if (this.chunks.length === 0) {
      this.recordError.set('common.error_generic');
      return;
    }

    const blob = new Blob(this.chunks, { type: this.chunks[0]?.type || 'audio/webm' });
    this.chunks = [];
    if (blob.size === 0) {
      this.recordError.set('common.error_generic');
      return;
    }

    this.clearLocalRecording();
    this.recordingBlob.set(blob);
    this.recordingUrl.set(URL.createObjectURL(blob));
    this.hasRecording.set(true);
  }

  private cleanupRecording(): void {
    this.clearRecordingTimer();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;
    this.stopAudioStream();
    this.stopPreviewAudio();
    this.clearLocalRecording();
  }

  private stopAudioStream(): void {
    this.audioStream?.getTracks().forEach((track) => track.stop());
    this.audioStream = null;
  }

  private stopPreviewAudio(): void {
    if (this.previewAudio) {
      this.previewAudio.pause();
      this.previewAudio.src = '';
      this.previewAudio = null;
    }
    this.isPlaying.set(false);
  }

  private clearRecordingTimer(): void {
    if (this.recordingTimer !== null) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
  }

  private clearLocalRecording(): void {
    const url = this.recordingUrl();
    if (url) URL.revokeObjectURL(url);
    this.recordingUrl.set('');
    this.recordingBlob.set(null);
    this.hasRecording.set(false);
  }

  private toSafeHttpUrl(value: string | null | undefined): string | null {
    if (!value) return null;
    try {
      const url = new URL(value.trim());
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
  }
}
