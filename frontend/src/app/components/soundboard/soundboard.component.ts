import {
    Component,
    inject,
    input,
    signal,
    effect,
    DestroyRef,
} from '@angular/core';

import { I18nService } from '../../services/i18n.service';
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
  imports: [],
  template: `
    <div class="flex flex-wrap gap-3 ps-2 pe-2">
      @for (sound of sounds(); track sound.id) {
        <button
          type="button"
          class="flex items-center gap-2 rounded-full border border-text-secondary/30
                 bg-surface-100 px-4 py-2 text-text-primary
                 transition-colors duration-150 hover:bg-surface-200
                 disabled:cursor-not-allowed disabled:opacity-50"
          [disabled]="!canPlay()"
          (click)="playSound(sound)"
        >
          <span aria-hidden="true">{{ sound.icon }}</span>
          <span>{{ sound.name }}</span>
        </button>
      }
    </div>
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
  private readonly i18n = inject(I18nService);
  private readonly hapticFeedback = inject(HapticFeedbackService);

  // --- Inputs ---

  /** The audio room identifier for which the soundboard is displayed. */
  readonly roomId = input.required<string>();

  /** The ID of the user who is the host (or co‑host) of the room.
   *  Only the host/co‑host can trigger sounds.
   */
  readonly hostUserId = input.required<string>();

  // --- State ---

  /** Whether the current user is allowed to play sounds. */
  readonly canPlay = signal(false);

  /** List of available sound effects loaded from the backend. */
  readonly sounds = signal<SoundItem[]>([]);

  // --- Audio element used for playback ---
  private playbackAudio: HTMLAudioElement | null = null;

  // Keep track of the current centrifugo subscription to clean up
  private currentSubscriptionChannel: string | null = null;

  constructor() {
    // Determine permissions based on current user
    effect(() => {
      const currentUserId = this.authService.currentUser()?.id;
      const hostId = this.hostUserId();
      this.canPlay.set(currentUserId === hostId);
    });

    // Load sounds when component is created and whenever roomId changes
    effect(() => {
      void this.loadSounds();
    });

    // Subscribe to Centrifugo events for soundboard playback
    effect(() => {
      const room = this.roomId();
      if (!room) return;

      const channel = `room_${room}`;

      // Clean up previous subscription if room changed
      if (this.currentSubscriptionChannel && this.currentSubscriptionChannel !== channel) {
        this.centrifugoService.unsubscribe(this.currentSubscriptionChannel);
      }
      this.currentSubscriptionChannel = channel;

      this.centrifugoService.subscribe(channel, (data: unknown) => {
        if (
          data &&
          typeof data === 'object' &&
          'type' in data &&
          'sound_url' in data
        ) {
          const d = data;
          const eventType = d['type'];
          const soundUrl = d['sound_url'];
          if (
            typeof eventType === 'string' &&
            eventType === 'soundboard_play' &&
            typeof soundUrl === 'string'
          ) {
            this.playRemoteSound(soundUrl);
          }
        }
      });
    });

    // Clean up centrifugo subscription on destroy
    this.destroyRef.onDestroy(() => {
      if (this.currentSubscriptionChannel) {
        this.centrifugoService.unsubscribe(this.currentSubscriptionChannel);
        this.currentSubscriptionChannel = null;
      }
    });
  }

  private async loadSounds(): Promise<void> {
    try {
      const response = await this.soundboardService.getSounds();
      this.sounds.set(response.sounds);
    } catch {
      // Silently fail – component will show nothing
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
      // The server will broadcast a 'soundboard_play' Centrifugo event,
      // which we handle in the subscription above.
    } catch {
      // Optionally notify the user that the sound could not be played
    }
  }

  private playRemoteSound(url: string): void {
    // Stop any previously playing sound
    if (this.playbackAudio) {
      this.playbackAudio.pause();
      this.playbackAudio = null;
    }

    const audio = new Audio(url);
    audio.volume = 0.6;
    audio.play().catch(() => {
      // Ignore autoplay restrictions; user will hear the sound
      // when they have interacted with the page.
    });
    this.playbackAudio = audio;

    // Clean up after playback finishes
    audio.addEventListener('ended', () => {
      if (this.playbackAudio === audio) {
        this.playbackAudio = null;
      }
    });
  }
}
