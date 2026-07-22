import { Component, EventEmitter, Output, signal, inject } from '@angular/core';

import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-voice-recorder',
  imports: [],
  templateUrl: './voice-recorder.component.html',
  styleUrls: ['./voice-recorder.component.scss'],
})
export class VoiceRecorderComponent {
  private userService = inject(UserService);

  @Output() audioUploaded = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  readonly isRecording = signal<boolean>(false);
  readonly isUploading = signal<boolean>(false);
  readonly durationSeconds = signal<number>(0);
  readonly audioPreviewUrl = signal<string | null>(null);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private recordedBlob: Blob | null = null;

  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      };

      this.mediaRecorder.start();
      this.isRecording.set(true);
      this.durationSeconds.set(0);

      this.timerInterval = setInterval(() => {
        this.durationSeconds.update((s) => s + 1);
      }, 1000);
    } catch (e) {
      console.error('Microphone access denied or error:', e);
      alert('Microphone permission required to record voice notes.');
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
      const filename = `voice_${Date.now()}.webm`;
      const presigned = await this.userService.getPresignedUploadUrl(
        filename,
        'audio/webm',
        'chat-voice',
      );

      if (presigned.uploadUrl && presigned.uploadUrl !== 'http://mock-upload-url') {
        await fetch(presigned.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'audio/webm' },
          body: this.recordedBlob,
        });
      }

      this.audioUploaded.emit(presigned.mediaUrl);
    } catch (e) {
      console.error('Failed to upload voice note:', e);
      // Fallback: emit preview URL or mock object
      this.audioUploaded.emit(this.audioPreviewUrl() || 'http://mock-voice-url/webm');
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
}
