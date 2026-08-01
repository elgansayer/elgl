import { showToast } from '../../services/toast.service';
import { Component, output, signal, inject, OnDestroy } from '@angular/core';

import { TranslatePipe } from '../../services/translate.pipe';

import { UserService } from '../../services/user.service';
import { AudioCompressionService } from '../../services/audio-compression.service';

@Component({
  selector: 'app-voice-recorder',
  imports: [TranslatePipe],
  templateUrl: './voice-recorder.component.html',
  styleUrls: ['./voice-recorder.component.scss'],
})
export class VoiceRecorderComponent implements OnDestroy {
  private userService = inject(UserService);
  private audioCompressionService = inject(AudioCompressionService);

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
      // Compress the audio blob before uploading
      const compressedBlob = await this.audioCompressionService.compressAudio(this.recordedBlob);

      const filename = `voice_${Date.now()}.wav`;
      const presigned = await this.userService.getPresignedUploadUrl(
        filename,
        'audio/wav',
        'chat-voice',
      );

      if (presigned.uploadUrl && presigned.uploadUrl !== 'http://mock-upload-url') {
        await fetch(presigned.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'audio/wav' },
          body: compressedBlob,
        });
      }

      this.audioUploaded.emit(presigned.mediaUrl);
    } catch (e) {
      console.error('Failed to upload voice note:', e);
      // Fallback: emit preview URL or mock object
      this.audioUploaded.emit(this.audioPreviewUrl() || 'http://mock-voice-url/wav');
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
