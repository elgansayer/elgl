import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { DiscoveryService } from '../../services/discovery.service';
import { UserProfile } from '../../services/user.service';
import { resource } from '@angular/core';
import { getLanguageFlag } from '../../components/primitives/language-picker/language-picker.component';

@Component({
  selector: 'app-audio-intro-feed',
  imports: [HlmButton, CommonModule, TranslatePipe],
  template: `
    @if (isLoading()) {
      <div class="flex justify-center py-8">
        <span class="i-ph-spinner-gap-bold animate-spin text-2xl text-primary"></span>
      </div>
    }
    <div class="divide-y divide-surface-dim">
      @for (user of userList(); track user.id) {
        <div class="flex items-center gap-3 p-3">
          <img
            class="h-10 w-10 rounded-full object-cover"
            [src]="user.avatar_url || '/assets/default-avatar.png'"
            alt=""
            loading="lazy"
          />
          <div class="flex-1 min-w-0">
            <p class="truncate font-medium text-text">{{ user.display_name }}</p>
            <p class="text-xs text-text-secondary">
              {{ user.native_languages?.join(', ') }} → {{ user.target_languages?.join(', ') }}
            </p>
          </div>
          <button
            hlmBtn
            (click)="togglePlay(user.id, user.audio_intro_url)"
            class="ms-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary"
          >
            @if (playingId() === user.id) {
              <span class="i-ph-pause-fill text-white text-lg"></span>
            } @else {
              <span class="i-ph-play-fill text-white text-lg"></span>
            }
          </button>
        </div>
      } @empty {
        @if (!isLoading()) {
          <div class="flex flex-col items-center py-12 text-text-secondary">
            <span class="i-ph-microphone-slash text-4xl mb-2"></span>
            <p>{{ 'discovery.audioIntroFeed.noAudioIntros' | t }}</p>
          </div>
        }
      }
    </div>
  `,
})
export class AudioIntroFeedComponent {
  private discoveryService = inject(DiscoveryService);
  private destroyRef = inject(DestroyRef);

  readonly playingId = signal<string | null>(null);
  private audioPlayer: HTMLAudioElement | null = null;

  private readonly usersResource = resource({
    loader: () => this.discoveryService.getAudioIntros(),
  });

  readonly users = computed<UserProfile[]>(() => this.usersResource.value() ?? []);
  readonly isLoading = computed(() => this.usersResource.isLoading());
  readonly emptyMessageKey = signal('discovery.audioIntroFeed.noAudioIntros');

  readonly userList = this.users;

  togglePlay(userId: string, url: string | undefined, _event?: Event): void {
    if (!url) return;
    if (this.playingId() === userId) {
      this.audioPlayer?.pause();
      this.playingId.set(null);
      return;
    }
    this.audioPlayer?.pause();
    this.audioPlayer = new Audio(url);
    this.audioPlayer.addEventListener('ended', () => this.playingId.set(null));
    this.audioPlayer.play();
    this.playingId.set(userId);
  }

  getFlag(code: string): string {
    return getLanguageFlag(code);
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.audioPlayer?.pause();
      this.audioPlayer = null;
    });
  }
}
