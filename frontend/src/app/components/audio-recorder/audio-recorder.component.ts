import { HlmButton } from '@spartan-ng/helm/button';
import {
  Component,
  inject,
  viewChild,
  Input,
  Output,
  EventEmitter,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { AudioIntroService } from '../../services/audio-intro.service';

@Component({
  selector: 'app-audio-recorder',
  imports: [HlmButton, CommonModule, TranslatePipe],
  templateUrl: './audio-recorder.component.html',
  host: { class: 'block' },
})
export class AudioRecorderComponent implements OnDestroy {
  @Input({ required: true }) userId!: string;
  @Input() existingAudioUrl = '';
  @Output() audioChanged = new EventEmitter<string>();

  private audioIntroService = inject(AudioIntroService);
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private readonly audioPlayer = viewChild<HTMLAudioElement>('audioPlayer');
  private audioStream: MediaStream | null = null;

  recording = false;
  duration = 0;
  localPreviewUrl = '';
  error = '';
  uploading = false;
  isPlaying = false;

  async startRecording(): Promise<void> {
    this.error = '';
    this.audioChunks = [];
    this.duration = 0;
    this.localPreviewUrl = '';

    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'Unable to access microphone';
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const recorder = new MediaRecorder(this.audioStream, { mimeType });
    this.mediaRecorder = recorder;

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(this.audioChunks, { type: recorder.mimeType });
      const url = URL.createObjectURL(blob);
      this.localPreviewUrl = url;
      this.recording = false;
      this.audioStream?.getTracks().forEach((track) => track.stop());
      this.audioStream = null;
      this.stopTimer();
    };

    recorder.start(100);
    this.recording = true;

    this.timerInterval = setInterval(() => {
      this.duration += 1;
      if (this.duration >= 30) {
        this.stopRecording();
      }
    }, 1000);
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.stopTimer();
  }

  discardRecording(): void {
    if (this.localPreviewUrl) {
      URL.revokeObjectURL(this.localPreviewUrl);
    }
    this.localPreviewUrl = '';
    this.audioChunks = [];
    this.duration = 0;
    this.error = '';
  }

  async uploadRecording(): Promise<void> {
    const blob = new Blob(this.audioChunks, {
      type: this.mediaRecorder?.mimeType ?? 'audio/webm',
    });
    this.uploading = true;
    this.error = '';
    try {
      const { uploadUrl, mediaUrl } = await this.audioIntroService.getPresignedUploadUrl(
        `audio_intro_${Date.now()}.webm`,
        blob.type,
      );

      const uploadResp = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': blob.type },
      });
      if (!uploadResp.ok) throw new Error('Upload failed');

      await this.audioIntroService.updateAudioIntro(this.userId, mediaUrl);
      this.audioChanged.emit(mediaUrl);
      this.discardRecording(); // clean up local preview
    } catch (err: unknown) {
      this.error = err instanceof Error ? err.message : 'Upload error';
    } finally {
      this.uploading = false;
    }
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  ngOnDestroy(): void {
    this.stopTimer();
    this.audioStream?.getTracks().forEach((t) => t.stop());
    if (this.localPreviewUrl) {
      URL.revokeObjectURL(this.localPreviewUrl);
    }
  }
}
