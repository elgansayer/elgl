import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { DiscoveryService } from '../../services/discovery.service';
import { AuthService } from '../../services/auth.service';
import { UserProfile } from '../../services/user.service';

@Component({
  selector: 'app-audio-intro-feed',
  imports: [CommonModule, HlmButton, RouterLink, TranslatePipe],
  template: `
    <section
      class="bg-surface-500 px-4 py-6 md:px-6 lg:px-8"
      aria-labelledby="audio-intro-feed-heading"
    >
      <div
        class="mx-auto max-w-3xl overflow-hidden rounded-card border border-surface-100 bg-surface-400 shadow-card"
      >
        <header class="border-b border-surface-100 px-4 py-4 sm:px-5">
          <h1 id="audio-intro-feed-heading" class="text-xl font-bold text-text-primary">
            {{ 'discovery.audioIntroFeed.title' | t }}
          </h1>
        </header>

        @if (isLoading()) {
          <div
            class="flex items-center justify-center gap-2 py-10"
            role="status"
            aria-live="polite"
          >
            <span
              class="i-ph-spinner-gap-bold animate-spin text-2xl text-primary motion-reduce:animate-none"
              aria-hidden="true"
            ></span>
            <span class="sr-only">{{ 'common.loading' | t }}</span>
          </div>
        } @else if (loadError()) {
          <div class="flex flex-col items-center gap-3 px-4 py-10 text-center" role="alert">
            <p class="text-sm text-danger">{{ 'common.error_generic' | t }}</p>
            <button hlmBtn type="button" variant="secondary" size="touch" (click)="retryLoad()">
              {{ 'common.retry' | t }}
            </button>
          </div>
        } @else {
          @if (userList().length > 0) {
            <div class="sr-only" role="status" aria-live="polite">
              {{ 'discovery.audioIntroFeed.resultCount' | t: { count: userList().length } }}
            </div>
          }
          <div class="divide-y divide-surface-100">
            @for (user of userList(); track user.id) {
              <article class="flex min-w-0 items-center gap-3 p-3 sm:p-4">
                <a
                  [routerLink]="['/profile', user.id]"
                  class="flex min-w-0 flex-1 items-center gap-3 rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:ring-2 focus-visible:ring-primary"
                >
                  @if (user.avatar_url) {
                    <img
                      class="h-11 w-11 shrink-0 rounded-full object-cover"
                      [src]="user.avatar_url"
                      alt=""
                      loading="lazy"
                    />
                  } @else {
                    <span
                      class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-200 font-semibold text-text-secondary"
                      aria-hidden="true"
                    >
                      {{ displayName(user).charAt(0) }}
                    </span>
                  }
                  <div class="min-w-0 flex-1">
                    <p
                      [id]="'audio-intro-user-' + user.id"
                      class="break-words font-medium text-text-primary"
                    >
                      {{ displayName(user) }}
                    </p>
                    @if (hasLanguagePair(user)) {
                      <p
                        data-testid="audio-intro-language-pair"
                        class="break-words text-xs text-text-secondary"
                      >
                        {{
                          'discovery.audioIntroFeed.languagePair'
                            | t
                              : {
                                  native: formatLanguages(user.native_languages),
                                  target: formatLanguages(user.target_languages),
                                }
                        }}
                      </p>
                    }
                  </div>
                </a>

                @if (user.audio_intro_url) {
                  <button
                    hlmBtn
                    type="button"
                    size="icon-touch"
                    (click)="togglePlay(user.id, user.audio_intro_url)"
                    class="ms-auto shrink-0 rounded-full"
                    [attr.aria-label]="
                      playingId() === user.id ? ('audioIntro.pause' | t) : ('audioIntro.play' | t)
                    "
                    [attr.aria-describedby]="'audio-intro-user-' + user.id"
                  >
                    @if (playingId() === user.id) {
                      <span class="i-ph-pause-fill text-lg" aria-hidden="true"></span>
                    } @else {
                      <span class="i-ph-play-fill text-lg" aria-hidden="true"></span>
                    }
                  </button>
                }
              </article>
            } @empty {
              <div
                class="flex flex-col items-center px-4 py-12 text-center text-text-secondary"
                role="status"
              >
                <span class="i-ph-microphone-slash mb-2 text-4xl" aria-hidden="true"></span>
                <p>{{ 'discovery.audioIntroFeed.noAudioIntros' | t }}</p>
              </div>
            }
          </div>
        }

        @if (playbackError()) {
          <p class="border-t border-surface-100 px-4 py-3 text-sm text-danger" role="alert">
            {{ 'audioPlayer.error' | t }}
          </p>
        }
      </div>
    </section>
  `,
})
export class AudioIntroFeedComponent {
  private readonly discoveryService = inject(DiscoveryService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18n = inject(I18nService);
  private readonly languageDisplayNames = computed(() => {
    try {
      return new Intl.DisplayNames([this.i18n.currentLang()], { type: 'language' });
    } catch {
      return null;
    }
  });

  readonly playingId = signal<string | null>(null);
  readonly playbackError = signal(false);
  private audioPlayer: HTMLAudioElement | null = null;

  private readonly usersResource = resource({
    params: () => {
      if (this.authService.isLoading()) return undefined;
      return this.authService.getAccessToken();
    },
    loader: () => this.discoveryService.getAudioIntros(),
  });

  readonly users = computed<UserProfile[]>(() => this.usersResource.value() ?? []);
  readonly isLoading = computed(
    () => this.authService.isLoading() || this.usersResource.isLoading(),
  );
  readonly loadError = computed(() => Boolean(this.usersResource.error()));
  readonly userList = this.users;

  retryLoad(): void {
    this.usersResource.reload();
  }

  displayName(user: UserProfile): string {
    return user.display_name?.trim() || this.i18n.translate('common.unknownUser');
  }

  formatLanguages(codes: string[] | undefined): string {
    return (codes ?? [])
      .map((code) => {
        try {
          return this.languageDisplayNames()?.of(code) ?? code;
        } catch {
          return code;
        }
      })
      .join(', ');
  }

  hasLanguagePair(user: UserProfile): boolean {
    return Boolean(user.native_languages?.length && user.target_languages?.length);
  }

  async togglePlay(userId: string, url: string | undefined): Promise<void> {
    if (!url) return;

    this.playbackError.set(false);

    if (this.playingId() === userId) {
      this.stopPlayback();
      return;
    }

    this.stopPlayback();

    const player = new Audio(url);
    this.audioPlayer = player;

    const clearCurrentPlayer = () => {
      if (this.audioPlayer !== player) return;
      this.audioPlayer = null;
      this.playingId.set(null);
    };

    player.addEventListener('ended', clearCurrentPlayer, { once: true });
    player.addEventListener('pause', clearCurrentPlayer);
    const failCurrentPlayer = () => {
      if (this.audioPlayer !== player) return;
      clearCurrentPlayer();
      this.playbackError.set(true);
    };

    player.addEventListener('error', failCurrentPlayer, { once: true });

    try {
      await player.play();
      if (this.audioPlayer === player) {
        this.playingId.set(userId);
      }
    } catch {
      failCurrentPlayer();
    }
  }

  constructor() {
    this.destroyRef.onDestroy(() => this.stopPlayback());
  }

  private stopPlayback(): void {
    this.audioPlayer?.pause();
    this.audioPlayer = null;
    this.playingId.set(null);
  }
}
