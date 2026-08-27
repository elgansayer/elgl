import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';
import {
  HashtagTopicsService,
  type HashtagFeedResponse,
} from '../../services/hashtag-topics.service';
import type { MomentRecord } from '../../services/moments.store';

@Component({
  selector: 'app-hashtag-topic-page',
  standalone: true,
  imports: [HlmButton, RouterLink, TranslatePipe],
  template: `
    <main class="app-screen bg-surface-500 p-4 sm:p-6">
      <div class="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <header class="rounded-card border border-surface-100 bg-surface-200 p-4 shadow-card">
          <a
            routerLink="/moments"
            class="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            ← {{ 'nav.moments' | t }}
          </a>
          <div class="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 class="min-w-0 text-2xl font-black text-text-primary" dir="auto">#{{ hashtag() }}</h1>
            <button
              hlmBtn
              type="button"
              size="touch"
              [disabled]="isLoading() || isMutating() || hasError()"
              [attr.aria-pressed]="isFollowing()"
              (click)="toggleFollow()"
              class="rounded-pill"
            >
              {{ isFollowing() ? ('topics.following' | t) : ('topics.follow' | t) }}
            </button>
          </div>
        </header>

        @if (isLoading()) {
          <p class="rounded-card bg-surface-200 p-6 text-center text-text-secondary" role="status">
            {{ 'common.loading' | t }}
          </p>
        } @else if (hasError()) {
          <section class="rounded-card bg-surface-200 p-6 text-center" role="alert">
            <p class="text-danger">{{ 'common.error_generic' | t }}</p>
            <button hlmBtn type="button" variant="outline" size="touch" class="mt-3" (click)="load()">
              {{ 'common.retry' | t }}
            </button>
          </section>
        } @else {
          <section class="flex flex-col gap-3" [attr.aria-label]="'#' + hashtag()">
            @for (moment of moments(); track moment.id) {
              <article class="rounded-card border border-surface-100 bg-surface-200 p-4 shadow-card">
                <div class="flex items-start justify-between gap-3">
                  <a
                    [routerLink]="['/profile', moment.author?.id ?? moment.user_id]"
                    class="font-bold text-text-primary underline-offset-2 hover:underline"
                    dir="auto"
                  >
                    {{ moment.author?.display_name || ('common.languagePartner' | t) }}
                  </a>
                  <time class="shrink-0 text-xs text-text-secondary">{{ moment.created_at }}</time>
                </div>
                @if (moment.text_content) {
                  <p class="mt-3 whitespace-pre-wrap break-words text-text-primary" dir="auto">
                    {{ moment.text_content }}
                  </p>
                }
                <div class="mt-3 flex gap-4 text-xs text-text-secondary">
                  <span>♥ {{ moment.likes_count || 0 }}</span>
                  <span>💬 {{ moment.comments_count || 0 }}</span>
                </div>
              </article>
            } @empty {
              <p class="rounded-card bg-surface-200 p-6 text-center text-text-secondary">
                {{ 'topics.empty' | t }}
              </p>
            }
          </section>
        }
      </div>
    </main>
  `,
})
export class HashtagTopicPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly hashtagTopicsService = inject(HashtagTopicsService);

  readonly hashtag = signal(this.route.snapshot.paramMap.get('hashtag') ?? '');
  readonly moments = signal<MomentRecord[]>([]);
  readonly isFollowing = signal(false);
  readonly isLoading = signal(true);
  readonly isMutating = signal(false);
  readonly hasError = signal(false);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.isLoading.set(true);
    this.hasError.set(false);
    try {
      this.applyResponse(await this.hashtagTopicsService.getHashtagFeed(this.hashtag()));
    } catch {
      this.moments.set([]);
      this.hasError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  async toggleFollow(): Promise<void> {
    if (this.isMutating() || this.hasError()) return;
    this.isMutating.set(true);
    try {
      if (this.isFollowing()) {
        await this.hashtagTopicsService.unfollow(this.hashtag());
        this.isFollowing.set(false);
      } else {
        await this.hashtagTopicsService.follow(this.hashtag());
        this.isFollowing.set(true);
      }
    } catch {
      this.hasError.set(true);
    } finally {
      this.isMutating.set(false);
    }
  }

  private applyResponse(response: HashtagFeedResponse): void {
    this.hashtag.set(response.hashtag);
    this.isFollowing.set(response.is_following);
    this.moments.set(response.moments);
  }
}
