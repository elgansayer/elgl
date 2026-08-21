import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import {
  DiscoveryRecommendation,
  RecommendationReason,
  RecommendationsService,
} from '../../../services/recommendations.service';

@Component({
  selector: 'app-recommended-for-you-carousel',
  imports: [RouterLink, HlmButton],
  templateUrl: './recommended-for-you-carousel.component.html',
  styleUrls: ['./recommended-for-you-carousel.component.scss'],
})
export class RecommendedForYouCarouselComponent {
  private readonly recommendationsService = inject(RecommendationsService);

  @ViewChild('carousel') private carousel?: ElementRef<HTMLElement>;

  readonly recommendations = signal<DiscoveryRecommendation[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const recommendations = await this.recommendationsService.getDiscoveryRecommendations();
      // Keep the order returned by the server stable for the lifetime of this load.
      this.recommendations.set(recommendations.slice(0, 10));
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  scroll(direction: -1 | 1): void {
    const element = this.carousel?.nativeElement;
    if (!element) return;
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollBy({
      left: direction * Math.max(240, element.clientWidth * 0.75),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }

  onCarouselKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.scroll(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.scroll(1);
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
}
