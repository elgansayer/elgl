import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';
import { CentrifugoService } from '../../services/centrifugo.service';
import { AuthService } from '../../services/auth.service';
import {
  SoundItem,
  SoundboardService,
} from '../../services/soundboard.service';
import { HapticFeedbackService } from '../../services/haptic-feedback.service';
import { getBundledSoundboardClip } from '../../services/soundboard-clips';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Component({
  selector: 'app-soundboard',
  imports: [TranslatePipe, ...HlmButtonImports],
  template: `
    @if (canPlay()) {
      <section
        class="border-t border-surface-100 bg-surface-300 px-3 py-3"
        [attr.aria-busy]="isLoading()"
      >
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            {{ 'soundboard.title' | t }}
          </h4>
          @if (isLoading()) {
            <span class="text-xs text-text-muted" role="status">
              {{ 'common.loading' | t }}
            </span>
          }
        </div>

        @if (loadError()) {
          <div class="flex flex-wrap items-center gap-2" role="alert">
            <span class="text-xs text-danger">{{ 'common.error' | t }}</span>
            <button hlmBtn type="button" variant="outline" size="sm" (click)="retryLoad()">
              {{ 'common.retry' | t }}
            </button>
          </div>
        } @else if (!isLoading()) {
          <div class="flex flex-wrap gap-2">
            @for (sound of sounds(); track sound.id) {
              <button
                hlmBtn
                type="button"
                variant="outline"
                size="sm"
                class="min-h-11 rounded-full"
                [disabled]="playingSoundId() !== null"
                (click)="playSound(sound)"
                [attr.aria-label]="'soundboard.playLabel' | t: { name: sound.name }"
                [attr.aria-busy]="playingSoundId() === sound.id"
              >
                <span aria-hidden="true" class="text-base">{{ sound.icon }}</span>
                <span dir="auto">{{ sound.name }}</span>
              </button>
            }
          </div>
        }

        @if (playError()) {
          <p class="mt-2 text-xs text-danger" role="alert">{{ 'common.error' | t }}</p>
        }
      </section>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class SoundboardComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly soundboardService = inject(SoundboardService);
  private readonly centrifugoService = inject(CentrifugoService);
  private readonly authService = inject(AuthService);
  private readonly hapticFeedback = inject(HapticFeedbackService);

  readonly roomId = input<string>('');
  readonly hostUserId = input<string>('');
  readonly coHostUserId = input<string>('');
  readonly canPlay = computed(() => {
    const currentUserId = this.authService.currentUser()?.id;
    return !!(
      currentUserId &&
      (currentUserId === this.hostUserId() || currentUserId === this.coHostUserId())
    );
  });
  readonly sounds = signal<SoundItem[]>([]);
  readonly isLoading = signal(false);
  readonly loadError = signal(false);
  readonly playError = signal(false);
  readonly playingSoundId = signal<string | null>(null);

  private playbackAudio: HTMLAudioElement | null = null;
  private loadGeneration = 0;
  private lastProcessedEventCount = 0;

  constructor() {
    effect(() => {
      const room = this.roomId().trim();
      if (!room || typeof window === 'undefined') return;
      untracked(() => void this.loadSounds(room));
    });

    effect(() => {
      const room = this.roomId().trim();
      const events = this.centrifugoService.events();
      if (!room || events.length === 0 || events.length === this.lastProcessedEventCount) {
        return;
      }

      this.lastProcessedEventCount = events.length;
      const latest = events.at(-1);
      if (!latest || latest.channel !== `room_${room}` || !isRecord(latest.data)) {
        return;
      }
      if (latest.data['type'] !== 'soundboard_play') return;

      const soundId =
        typeof latest.data['sound_id'] === 'string'
          ? latest.data['sound_id'].trim()
          : '';
      const clip = getBundledSoundboardClip(soundId);
      if (!clip) return;

      untracked(() => this.playRemoteSound(clip.audioDataUrl));
    });

    this.destroyRef.onDestroy(() => {
      this.loadGeneration += 1;
      this.playbackAudio?.pause();
      this.playbackAudio = null;
    });
  }

  retryLoad(): void {
    const room = this.roomId().trim();
    if (!room || this.isLoading()) return;
    void this.loadSounds(room);
  }

  async playSound(sound: SoundItem): Promise<void> {
    if (!this.canPlay() || this.playingSoundId() !== null) return;
    const roomId = this.roomId().trim();
    if (!roomId) return;

    this.playError.set(false);
    this.playingSoundId.set(sound.id);
    this.hapticFeedback.tap();
    try {
      await this.soundboardService.playSound(roomId, sound.id);
    } catch {
      this.playError.set(true);
    } finally {
      this.playingSoundId.set(null);
    }
  }

  private async loadSounds(roomId: string): Promise<void> {
    const generation = ++this.loadGeneration;
    this.isLoading.set(true);
    this.loadError.set(false);
    this.playError.set(false);

    try {
      const response = await this.soundboardService.getSounds();
      if (generation !== this.loadGeneration || this.roomId().trim() !== roomId) return;
      this.sounds.set(response.sounds);
    } catch {
      if (generation !== this.loadGeneration || this.roomId().trim() !== roomId) return;
      this.sounds.set([]);
      this.loadError.set(true);
    } finally {
      if (generation === this.loadGeneration && this.roomId().trim() === roomId) {
        this.isLoading.set(false);
      }
    }
  }

  private playRemoteSound(audioDataUrl: string): void {
    if (typeof Audio === 'undefined') return;
    this.playbackAudio?.pause();
    const audio = new Audio(audioDataUrl);
    audio.volume = 0.6;
    this.playbackAudio = audio;
    void audio.play().catch(() => {
      if (this.playbackAudio === audio) this.playbackAudio = null;
    });
    audio.addEventListener('ended', () => {
      if (this.playbackAudio === audio) this.playbackAudio = null;
    });
  }
}
