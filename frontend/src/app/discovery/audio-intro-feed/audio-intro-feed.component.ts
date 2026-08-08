import {
  Component,
  inject,
  signal,
  computed,
  input,
  DestroyRef,
} from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { UserProfile } from '../../services/user.service';
import { RouterLink } from '@angular/router';
import { SanitiseHtmlPipe } from '../../pipes/sanitise-html.pipe';
import { getLanguageFlag } from '../../components/primitives/language-picker/language-picker.component';

@Component({
  selector: 'app-audio-intro-feed',
  standalone: true,
  imports: [TranslatePipe, RouterLink, SanitiseHtmlPipe],
  template: `
    @if (isLoading()) {
      <section aria-live="polite" aria-busy="true" role="status">
        <span class="sr-only">{{ 'discovery.audioIntroFeed.loading' | t }}</span>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-surface-200" aria-hidden="true">
          @for (i of [1, 2, 3, 4, 5, 6]; track i) {
            <div class="bg-surface-500 animate-pulse p-4">
              <div class="flex items-center gap-3">
                <div class="h-12 w-12 rounded-full bg-surface-300"></div>
                <div class="flex-1 space-y-2">
                  <div class="h-4 w-24 rounded bg-surface-300"></div>
                  <div class="h-3 w-32 rounded bg-surface-300"></div>
                </div>
              </div>
            </div>
          }
        </div>
      </section>
    } @else if (users().length === 0) {
      <section aria-live="polite" class="flex flex-col items-center py-16 px-4">
        <span class="text-5xl mb-4" aria-hidden="true">🎙️</span>
        <p class="text-text-primary font-bold text-lg mb-2">{{ emptyMessageKey() | t }}</p>
        <p class="text-text-secondary text-sm">{{ 'discovery.audioIntroFeed.noAudioIntrosHint' | t }}</p>
      </section>
    } @else {
      <div class="sr-only" role="status" aria-live="polite">
        {{ 'discovery.audioIntroFeed.matchCount' | t: { count: users().length } }}
      </div>
      <div
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-surface-200"
        role="list"
        [attr.aria-label]="'discovery.audioIntroFeed.listLabel' | t"
      >
        @for (user of users(); track user.id) {
          <article
            class="flex items-center gap-3 p-4 bg-surface-500 hover:bg-surface-400 transition-colors cursor-pointer touch-manipulation active:bg-surface-400"
            role="listitem"
            [attr.aria-label]="('discovery.partnerCardLabel' | t: { name: user.display_name || ('discovery.partnerFallback' | t) })"
            [routerLink]="['/chat', user.id]"
          >
            <div class="relative shrink-0" [routerLink]="['/profile/user', user.id]">
              <img
                loading="lazy"
                [src]="user.avatar_url || 'https://i.pravatar.cc/150?u=' + user.id"
                [attr.alt]="('discovery.partnerAvatar' | t: { name: user.display_name || ('discovery.partnerFallback' | t) })"
                class="h-12 w-12 sm:h-14 sm:w-14 rounded-full object-cover"
              />
              <span
                class="absolute bottom-0 end-0 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-green-500 border-2 border-surface-500 rounded-full"
                aria-hidden="true"
              ></span>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 mb-0.5">
                <p class="truncate text-sm font-black text-text-primary">
                  {{ (user.display_name || ('discovery.partnerFallback' | t)) | sanitiseHtml }}
                </p>
                @if (user.is_vip) {
                  <span class="rounded bg-yellow-400 px-1.5 py-0.5 text-[8px] font-black uppercase text-black italic">{{
                    'discovery.vipBadge' | t
                  }}</span>
                }
              </div>
              <p class="text-xs text-text-secondary truncate">
                @for (lang of user.native_languages; track lang; let last = $last) {
                  <span>{{ getFlag(lang) }} {{ lang }}</span>
                  @if (!last) {<span>, </span>}
                }
                <span class="mx-1">→</span>
                @for (lang of user.target_languages; track lang; let last = $last) {
                  <span>{{ getFlag(lang) }} {{ lang }}</span>
                  @if (!last) {<span>, </span>}
                }
              </p>
              @if (user.bio_text) {
                <p class="text-[11px] sm:text-xs text-text-secondary mt-1 line-clamp-1">
                  {{ user.bio_text | sanitiseHtml }}
                </p>
              }
            </div>
            <button
              type="button"
              (click)="togglePlay(user.id, user.audio_intro_url, $event)"
              [attr.aria-pressed]="playingId() === user.id"
              [attr.aria-label]="
                (playingId() === user.id ? 'discovery.pauseAudioIntro' : 'discovery.playAudioIntro') | t
              "
              class="shrink-0 flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-accent-500/20 text-accent-500 hover:bg-accent-500/30 transition-colors hover:scale-105 active:scale-95"
            >
              <span aria-hidden="true" class="text-lg sm:text-xl">
                {{ playingId() === user.id ? '⏸️' : '▶️' }}
              </span>
            </button>
          </article>
        }
      </div>
    }
  `,
})
export class AudioIntroFeedComponent {
  readonly users = input<UserProfile[]>([]);
  readonly isLoading = input<boolean>(false);
  readonly emptyMessageKey = input<string>('discovery.audioIntroFeed.noAudioIntros');

  private destroyRef = inject(DestroyRef);

  protected playingId = signal<string | null>(null);
  private audioPlayer: HTMLAudioElement | null = null;

  protected userList = computed(() => this.users());

  protected togglePlay(userId: string, url: string | undefined, event: Event): void {
    event.stopPropagation();
    if (!url) return;
    if (this.playingId() === userId) {
      this.stopAudio();
      return;
    }
    this.stopAudio();

    const audio = new Audio(url);
    const onEnded = () => this.stopAudio();
    const onError = () => this.stopAudio();
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    this.audioPlayer = audio;
    this.playingId.set(userId);
    void audio.play().catch(() => this.stopAudio());
  }

  private stopAudio(): void {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.currentTime = 0;
      this.audioPlayer.onended = null;
      this.audioPlayer.onerror = null;
      this.audioPlayer.src = '';
      this.audioPlayer.load();
      this.audioPlayer = null;
    }
    this.playingId.set(null);
  }

  protected getFlag(code: string): string {
    return getLanguageFlag(code);
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopAudio();
    });
  }
}