import {
  Component,
  inject,
  input,
  signal,
  effect,
  computed,
  untracked,
  DestroyRef,
} from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';
import { CentrifugoService } from '../../services/centrifugo.service';
import { AuthService } from '../../services/auth.service';
import { SoundboardService } from '../../services/soundboard.service';
import { HapticFeedbackService } from '../../services/haptic-feedback.service';

export interface SoundItem {
  id: string;
  name: string;
  url: string;
  icon: string;
}

@Component({
  selector: 'app-soundboard',
  imports: [TranslatePipe, ...HlmButtonImports],
  template: `
    @if (sounds().length > 0) {
      <div class="space-y-3">
        <h4 class="text-xs font-semibold uppercase tracking-wide text-text-secondary">{{ 'soundboard.title' | t }}</h4>
        <div class="flex flex-wrap gap-2">
          @for (sound of sounds(); track sound.id) {
            <button
              hlmBtn
              type="button"
              variant="outline"
              size="sm"
              class="rounded-full"
              [disabled]="!canPlay()"
              (click)="playSound(sound)"
              [attr.aria-label]="'soundboard.playLabel' | t: { name: sound.name }"
            >
              <span aria-hidden="true" class="text-base">{{ sound.icon }}</span>
              <span>{{ sound.name }}</span>
            </button>
          }
        </div>
      </div>
    }
  `,
  styles: [`:host { display: block; }`],
})
export class SoundboardComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly soundboardService = inject(SoundboardService);
  private readonly centrifugoService = inject(CentrifugoService);
  private readonly authService = inject(AuthService);
  private readonly hapticFeedback = inject(HapticFeedbackService);

  readonly roomId = input<string>('');
  readonly hostUserId = input<string>('');
  readonly canPlay = computed(() => {
    const currentUser = this.authService.currentUser();
    return !!(currentUser && currentUser.id === this.hostUserId());
  });
  readonly sounds = signal<SoundItem[]>([]);
  private playbackAudio: HTMLAudioElement | null = null;

  constructor() {
    effect(() => {
      const room = this.roomId();
      if (!room) return;
      untracked(() => void this.loadSounds());
    });

    effect(() => {
      const room = this.roomId();
      if (!room) return;
      this.centrifugoService.subscribe(`room_${room}`, (data: unknown) => {
        if (
          data &&
          typeof data === 'object' &&
          (data as Record<string, unknown>)['type'] === 'soundboard_play' &&
          typeof (data as Record<string, unknown>)['sound_url'] === 'string'
        ) {
          this.playRemoteSound((data as Record<string, unknown>)['sound_url'] as string);
        }
      });
    });

    this.destroyRef.onDestroy(() => this.playbackAudio?.pause());
  }

  private async loadSounds(): Promise<void> {
    try {
      const response = await this.soundboardService.getSounds();
      this.sounds.set(response.sounds);
    } catch {
      this.sounds.set([]);
    }
  }

  async playSound(sound: SoundItem): Promise<void> {
    if (!this.canPlay()) return;
    this.hapticFeedback.tap();
    const roomId = this.roomId();
    if (!roomId) return;
    try {
      await this.soundboardService.playSound(roomId, sound.id);
    } catch {
      // Soundboard failure is non-blocking room UI behavior.
    }
  }

  private playRemoteSound(url: string): void {
    this.playbackAudio?.pause();
    const audio = new Audio(url);
    audio.volume = 0.6;
    void audio.play().catch(() => undefined);
    this.playbackAudio = audio;
    audio.addEventListener('ended', () => {
      if (this.playbackAudio === audio) this.playbackAudio = null;
    });
  }
}
