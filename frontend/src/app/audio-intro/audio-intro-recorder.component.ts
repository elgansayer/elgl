import {
  Component,
  computed,
  effect,
  inject,
  input,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { interval } from 'rxjs';
import { TranslatePipe } from '../services/translate.pipe';
import { I18nService } from '../services/i18n.service';
import { AudioIntroService } from './audio-intro.service';

@Component({
  selector: 'app-audio-intro-recorder',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './audio-intro-recorder.component.html',
  styleUrls: ['./audio-intro-recorder.component.scss'],
})
export class AudioIntroRecorderComponent {
  readonly userId = input.required<string>();

  readonly isRecording = signal(false);
  readonly isPlaying = signal(false);
  readonly timer = signal(0);
  readonly errorMessage = signal<string | null>(null);

  private readonly audioResource = resource<
    { audio_url: string | null },
    { userId: string }
  >({
    params: () => ({ userId: this.userId() }),
    loader: (ctx) =>
      this.audioIntroService.getAudioIntro(ctx.params.userId).catch(() => {
        this.setError('audioIntro.errorLoading');
        return { audio_url: null };
      }),
  });

  readonly audioUrl = computed(() =>
    this.audioResource.value()?.audio_url ?? null,
  );

  readonly remainingSeconds = computed(() => 30 - this.timer());

  private readonly audioIntroService = inject(AudioIntroService);
  private readonly i18n = inject(I18nService);
  private readonly audioPlayer = viewChild<HTMLAudioElement>('audioPlayer');

  readonly audioIntroUrl = signal<string | null>(null);

  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async uploadAudio(blob: Blob): Promise<void> {
    try {
      const mediaUrl = await this.audioIntroService.uploadAudioBlob(blob);
      await this.audioIntroService.updateAudioIntro(this.userId(), mediaUrl);
      this.audioIntroUrl.set(mediaUrl);
    } catch {
      this.setError('audioIntro.uploadError');
    }
  }

  constructor() {
    effect(() => {
      const isRecording = this.isRecording();
      if (!isRecording) return;
      const timer$ = interval(1000);
      const sub = timer$.subscribe(() => {
        this.timer.update((val) => val + 1);
        if (this.timer() >= 30) {
          this.stopRecording();
        }
      });
      return () => sub.unsubscribe();
    });
  }

  private setError(key: string): void {
    this.errorMessage.set(this.i18n.translate(key));
  }

  async startRecording(): Promise<void> {
    if (this.isRecording()) {
      return;
    }
    this.errorMessage.set(null);
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.recordedChunks, {
            type: this.mediaRecorder?.mimeType || 'audio/webm',
          });
          this.recordedChunks = [];
          const mediaUrl = await this.audioIntroService.uploadAudioBlob(blob);
          await this.audioIntroService.updateAudioIntro(this.userId(), mediaUrl);
          this.audioResource.set({ audio_url: mediaUrl });
        } catch {
          this.setError('audioIntro.uploadError');
        } finally {
          this.timer.set(0);
          this.isRecording.set(false);
          this.stream?.getTracks().forEach((track) => track.stop());
          this.stream = null;
          this.mediaRecorder = null;
        }
      };

      this.mediaRecorder.start();
      this.timer.set(0);
      this.isRecording.set(true);
    } catch {
      this.setError('audioIntro.microphoneError');
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  togglePlayback(): void {
    const player = this.audioPlayer();
    if (!player) return;
    if (player.paused) {
      void player.play();
      this.isPlaying.set(true);
    } else {
      player.pause();
      this.isPlaying.set(false);
    }
  }
}
