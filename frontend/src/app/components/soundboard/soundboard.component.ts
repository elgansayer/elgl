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
  imports: [TranslatePipe],
  template: `
    @if (sounds().length > 0) {
      <div class="space-y-3">
        <h4 class="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          {{ 'soundboard.title' | t }}
        </h4>
        <div class="flex flex-wrap gap-2">
          @for (sound of sounds(); track sound.id) {
            <button
              type="button"
              class="flex items-center gap-2 rounded-full border border-text-secondary/30
                     bg-surface-100 px-4 py-2 text-sm text-text-primary
                     transition-colors duration-150 hover:bg-surface-200
                     disabled:cursor-not-allowed disabled:opacity-50"
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

  readonly canPlay = computed(() => {
    const currentUser = this.authService.currentUser();
    const hostId = this.hostUserId();
    return !!(currentUser && currentUser.id === hostId);
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
      const channel = `room_${room}`;
      this.centrifugoService.subscribe(channel, (data: unknown) => {
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
    const roomIdValue = this.roomId();
    if (!roomIdValue) return;
    try {
      await this.soundboardService.playSound(roomIdValue, sound.id);
    } catch {
      // Silently fail
    }
  }

  private playRemoteSound(url: string): void {
    if (this.playbackAudio) {
      this.playbackAudio.pause();
      this.playbackAudio = null;
    }
    const audio = new Audio(url);
    audio.volume = 0.6;
    audio.play().catch(() => { /* ignore autoplay restrictions */ });
    this.playbackAudio = audio;
    audio.addEventListener('ended', () => {
      if (this.playbackAudio === audio) {
        this.playbackAudio = null;
      }
    });
  }
}
