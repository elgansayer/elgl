import { HlmButton } from '@spartan-ng/helm/button';
import { Component, output, signal, inject, input, DestroyRef } from '@angular/core';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  private userService = inject(UserService);
  private destroyRef = inject(DestroyRef);

  // Inputs
  existingAudioUrl = input<string | null>(null);

  // Outputs
  recordingComplete = output<string>();

  // State
  isRecording = signal(false);
  isPlaying = signal(false);
  hasRecording = signal(false);
  recordingBlob = signal<Blob | null>(null);
  recordingUrl = signal<string>('');
  duration = signal(0);
  maxDuration = 30; // seconds
  recordError = signal<string | null>(null);
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private audioStream: MediaStream | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cleanupRecording();
    });
  }

  private cleanupRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.audioStream?.getTracks().forEach((t) => t.stop());
    this.audioStream = null;
    if (this.recordingUrl()) {
      URL.revokeObjectURL(this.recordingUrl());
    }
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  async startRecording(): Promise<void> {
    this.recordError.set(null);
    this.duration.set(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioStream = stream;
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      this.chunks = [];
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };
      this.mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        this.audioStream = null;
        const blob = new Blob(this.chunks, { type: 'audio/webm;codecs=opus' });
        this.recordingBlob.set(blob);
        this.hasRecording.set(true);
        this.recordingUrl.set(URL.createObjectURL(blob));
        this.isRecording.set(false);
        this.recordingComplete.emit(this.recordingUrl());
      };
      this.mediaRecorder.start();
      this.isRecording.set(true);

      // Timer with auto-cleanup via takeUntilDestroyed
      interval(1000)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.duration.update((d) => d + 1);
          if (this.duration() >= this.maxDuration) {
            this.stopRecording();
          }
        });
    } catch {
      this.recordError.set('Failed to start recording');
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  async uploadRecording(): Promise<void> {
    const blob = this.recordingBlob();
    if (!blob) return;
    this.recordError.set(null);
    try {
      const file = new File([blob], 'intro.webm', { type: blob.type });
      const { uploadUrl, mediaUrl } = await this.userService.getPresignedUploadUrl(
        file.name,
        blob.type,
        'audio-intro',
      );
      const resp = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': blob.type },
      });
      if (!resp.ok) throw new Error('Upload failed');
      await this.userService.updateMyProfile({ audio_intro_url: mediaUrl });
      this.recordingComplete.emit(mediaUrl);
    } catch {
      this.recordError.set('Upload failed');
    }
  }

  playPreview(): void {
    if (!this.recordingUrl()) return;
    const audio = new Audio(this.recordingUrl());
    audio.play().then(() => {
      this.isPlaying.set(true);
      audio.onended = () => this.isPlaying.set(false);
    });
  }
}
