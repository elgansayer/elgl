import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import {
  DiscoveryRecommendation,
  RecommendationReason,
  RecommendationsService,
} from '../../../services/recommendations.service';
import { StudyBuddiesService } from '../../../services/study-buddies.service';
import { TranslatePipe } from '../../../services/translate.pipe';

type RecommendationAction = 'follow' | 'message';

@Component({
  selector: 'app-recommended-for-you-carousel',
  imports: [RouterLink, HlmButton, TranslatePipe],
  templateUrl: './recommended-for-you-carousel.component.html',
  styleUrls: ['./recommended-for-you-carousel.component.scss'],
})
export class RecommendedForYouCarouselComponent {
  private readonly recommendationsService = inject(RecommendationsService);
  private readonly studyBuddiesService = inject(StudyBuddiesService);
  private readonly router = inject(Router);
  private loadRequestId = 0;

  @ViewChild('carousel') private carousel?: ElementRef<HTMLElement>;

  readonly recommendations = signal<DiscoveryRecommendation[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly followedUserIds = signal<ReadonlySet<string>>(new Set<string>());
  readonly pendingActions = signal<ReadonlySet<string>>(new Set<string>());
  readonly actionErrorUserIds = signal<ReadonlySet<string>>(new Set<string>());

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    const requestId = ++this.loadRequestId;
    this.loading.set(true);
    this.error.set(false);
    try {
      const recommendations = await this.recommendationsService.getDiscoveryRecommendations();
      if (requestId !== this.loadRequestId) return;

      // Keep the order returned by the server stable for the lifetime of this load.
      this.recommendations.set(recommendations.slice(0, 10));
    } catch {
      if (requestId === this.loadRequestId) {
        this.error.set(true);
      }
    } finally {
      if (requestId === this.loadRequestId) {
        this.loading.set(false);
      }
    }
  }

  scroll(direction: -1 | 1): void {
    const element = this.carousel?.nativeElement;
    if (!element) return;
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const distance = Math.max(240, element.clientWidth * 0.75);
    element.scrollBy({
      left: direction * distance * (this.isRtl(element) ? -1 : 1),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }

  onCarouselKeydown(event: KeyboardEvent): void {
    const rtl = this.isRtl(this.carousel?.nativeElement);

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.scroll(rtl ? 1 : -1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.scroll(rtl ? -1 : 1);
    }
  }

  isFollowing(userId: string): boolean {
    return this.followedUserIds().has(userId);
  }

  isActionPending(userId: string, action: RecommendationAction): boolean {
    return this.pendingActions().has(this.actionKey(userId, action));
  }

  hasActionError(userId: string): boolean {
    return this.actionErrorUserIds().has(userId);
  }

  async followUser(userId: string): Promise<void> {
    if (this.isFollowing(userId) || this.isActionPending(userId, 'follow')) return;

    this.setActionError(userId, false);
    this.setActionPending(userId, 'follow', true);
    try {
      await this.studyBuddiesService.follow(userId);
      this.followedUserIds.update((current) => {
        const next = new Set(current);
        next.add(userId);
        return next;
      });
    } catch {
      this.setActionError(userId, true);
    } finally {
      this.setActionPending(userId, 'follow', false);
    }
  }

  async sendMessage(userId: string): Promise<void> {
    if (this.isActionPending(userId, 'message')) return;

    this.setActionError(userId, false);
    this.setActionPending(userId, 'message', true);
    try {
      const { channel } = await this.studyBuddiesService.getOrCreateChannel(userId);
      if (!channel?.trim()) {
        throw new Error('Missing chat channel');
      }

      const navigated = await this.router.navigate(['/chat', 'room', channel]);
      if (!navigated) {
        throw new Error('Chat navigation was rejected');
      }
    } catch {
      this.setActionError(userId, true);
    } finally {
      this.setActionPending(userId, 'message', false);
    }
  }

  reasonLabel(
    reason: RecommendationReason,
    recommendation: DiscoveryRecommendation,
  ): string {
    switch (reason) {
      case 'language_exchange':
        return 'Language exchange match';
      case 'shared_interests':
        return recommendation.shared_interest_count === 1
          ? '1 shared interest'
          : `${recommendation.shared_interest_count} shared interests`;
      case 'active_recently':
        return 'Recently active';
      case 'study_streak':
        return 'Active learner';
    }
  }

  languageSummary(recommendation: DiscoveryRecommendation): string {
    const native = recommendation.native_languages[0]?.toUpperCase();
    const target = recommendation.target_languages[0]?.toUpperCase();
    if (native && target) return `${native} → ${target}`;
    return native ?? target ?? '';
  }

  private actionKey(userId: string, action: RecommendationAction): string {
    return `${userId}:${action}`;
  }

  private setActionPending(
    userId: string,
    action: RecommendationAction,
    pending: boolean,
  ): void {
    const key = this.actionKey(userId, action);
    this.pendingActions.update((current) => {
      const next = new Set(current);
      if (pending) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  private setActionError(userId: string, hasError: boolean): void {
    this.actionErrorUserIds.update((current) => {
      const next = new Set(current);
      if (hasError) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }

  private isRtl(element?: HTMLElement): boolean {
    const explicitDirection = element?.closest('[dir]')?.getAttribute('dir');
    if (explicitDirection) {
      return explicitDirection.toLowerCase() === 'rtl';
    }

    if (typeof document !== 'undefined') {
      const documentDirection = document.documentElement.getAttribute('dir');
      if (documentDirection) {
        return documentDirection.toLowerCase() === 'rtl';
      }
    }

    return (
      typeof window !== 'undefined' &&
      !!element &&
      typeof window.getComputedStyle === 'function' &&
      window.getComputedStyle(element).direction === 'rtl'
    );
  }
}
