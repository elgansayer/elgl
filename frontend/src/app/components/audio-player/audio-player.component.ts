import { HlmButton } from '@spartan-ng/helm/button';
import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-audio-player',
  imports: [HlmButton, TranslatePipe],
  templateUrl: './audio-player.component.html',
  styleUrl: './audio-player.component.scss',
})
export class AudioPlayerComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly src = input.required<string>();
  readonly durationSec = input<number | undefined>(undefined);

  protected readonly barCount = 40;

  protected readonly audioRef = viewChild<ElementRef<HTMLAudioElement>>('audioEl');

  protected readonly isPlaying = signal(false);
  protected readonly currentTime = signal(0);
  protected readonly duration = signal(0);
  protected readonly peaks = signal<number[]>([]);
  protected readonly isLoadingWaveform = signal(true);
  protected readonly hasError = signal(false);

  protected readonly progress = computed(() =>
    this.duration() > 0 ? Math.min(this.currentTime() / this.duration(), 1) : 0,
  );
  protected readonly activeBarCount = computed(() =>
    Math.round(this.progress() * this.peaks().length),
  );
  protected readonly formattedCurrentTime = computed(() => this.formatTime(this.currentTime()));
  protected readonly formattedDuration = computed(() => this.formatTime(this.duration()));

  constructor() {
    const controller = new AbortController();
    this.destroyRef.onDestroy(() => controller.abort());

    effect(() => {
      const url = this.src();
      untracked(() => void this.loadWaveform(url, controller.signal));
    });

    effect(() => {
      const hint = this.durationSec();
      if (hint === undefined) return;
      untracked(() => {
        if (this.duration() === 0) this.duration.set(hint);
      });
    });
  }

  protected togglePlay(): void {
    const audio = this.audioRef()?.nativeElement;
    if (!audio) return;

    if (this.isPlaying()) {
      audio.pause();
      return;
    }

    const playResult = audio.play();
    if (playResult && typeof playResult.then === 'function') {
      playResult.catch(() => this.hasError.set(true));
    }
  }

  protected onTimeUpdate(): void {
    const audio = this.audioRef()?.nativeElement;
    if (audio) this.currentTime.set(audio.currentTime);
  }

  protected onLoadedMetadata(): void {
    const audio = this.audioRef()?.nativeElement;
    if (audio && Number.isFinite(audio.duration)) {
      this.duration.set(audio.duration);
    }
  }

  protected onEnded(): void {
    this.isPlaying.set(false);
    this.currentTime.set(0);
  }

  protected onSeek(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const value = Number(target.value);
    const audio = this.audioRef()?.nativeElement;
    if (audio) audio.currentTime = value;
    this.currentTime.set(value);
  }

  protected formatTime(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private async loadWaveform(url: string, signal: AbortSignal): Promise<void> {
    this.isLoadingWaveform.set(true);
    try {
      if (typeof fetch === 'undefined' || typeof AudioContext === 'undefined') {
        throw new Error('Waveform decoding unavailable in this environment.');
      }

      const response = await fetch(url, { signal });
      const arrayBuffer = await response.arrayBuffer();
      const audioCtx = new AudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      if (signal.aborted) return;

      this.peaks.set(this.extractPeaks(audioBuffer.getChannelData(0), this.barCount));
      void audioCtx.close().catch(() => undefined);
    } catch (err) {
      if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) return;
      this.peaks.set(this.generateFallbackPeaks(url, this.barCount));
    } finally {
      if (!signal.aborted) this.isLoadingWaveform.set(false);
    }
  }

  private extractPeaks(channelData: Float32Array, barCount: number): number[] {
    const blockSize = Math.max(1, Math.floor(channelData.length / barCount));
    const peaks: number[] = [];

    for (let i = 0; i < barCount; i++) {
      const start = i * blockSize;
      const end = Math.min(start + blockSize, channelData.length);
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += Math.abs(channelData[j]);
      }
      peaks.push(end > start ? sum / (end - start) : 0);
    }

    const max = Math.max(...peaks, 0.0001);
    return peaks.map((peak) => Math.max(0.08, peak / max));
  }

  private generateFallbackPeaks(seed: string, barCount: number): number[] {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }

    const peaks: number[] = [];
    for (let i = 0; i < barCount; i++) {
      hash = (hash * 9301 + 49297) % 233280;
      peaks.push(0.15 + (Math.abs(hash) / 233280) * 0.85);
    }
    return peaks;
  }
}
