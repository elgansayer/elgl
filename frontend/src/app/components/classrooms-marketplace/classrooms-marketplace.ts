import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { AppCardComponent } from '../primitives/card/card.component';

/** A single tutor/classroom listing matching the HelloTalk design language. */
export interface ClassroomTutor {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string;
  readonly thumbnailUrl: string;
  readonly rating: number;
  readonly reviewCount: number;
  readonly hourlyRateGbp: number;
  readonly hourlyRateUsd: number;
  readonly teachingLanguages: readonly string[];
  readonly headline: string;
}

@Component({
  selector: 'app-classrooms-marketplace',
  imports: [TranslatePipe, AppCardComponent],
  template: `
    <section class="classrooms-marketplace">
      @if (isLoading()) {
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          @for (skeleton of [0, 1, 2]; track skeleton) {
            <div class="rounded-2xl bg-surface-50 border border-surface-100 animate-pulse overflow-hidden">
              <div class="aspect-video-thumb bg-surface-100"></div>
              <div class="p-4 space-y-3">
                <div class="h-4 bg-surface-100 rounded w-3/4"></div>
                <div class="h-3 bg-surface-100 rounded w-1/2"></div>
                <div class="h-3 bg-surface-100 rounded w-1/3"></div>
              </div>
            </div>
          }
        </div>
      } @else if (isEmpty()) {
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <div class="text-6xl mb-4" aria-hidden="true">{{ 'classrooms.emptyIcon' | t }}</div>
          <h2 class="text-xl font-semibold text-text-primary mb-2">
            {{ 'classrooms.emptyTitle' | t }}
          </h2>
          <p class="text-text-secondary text-sm max-w-md">
            {{ 'classrooms.emptyDescription' | t }}
          </p>
        </div>
      } @else {
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          @for (tutor of tutors(); track tutor.id) {
            <app-card
              variant="elevated"
              [customClass]="
                'overflow-hidden hover:shadow-lg transition-shadow group cursor-pointer border border-surface-100'
              "
            >
              <!-- Video Thumbnail -->
              <div class="relative aspect-video-thumb bg-black overflow-hidden rounded-t-2xl">
                <img
                  [src]="tutor.thumbnailUrl"
                  [alt]="'classrooms.videoThumbnailAlt' | t: { name: tutor.name }"
                  class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <!-- Play icon overlay -->
                <div
                  class="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none"
                  aria-hidden="true"
                >
                  <span class="w-12 h-12 flex items-center justify-center rounded-full bg-white/80 text-black">
                    {{ 'classrooms.playIcon' | t }}
                  </span>
                </div>
                <!-- Teaching language chip -->
                @if (tutor.teachingLanguages.length > 0) {
                  <div
                    class="absolute bottom-3 start-3 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full"
                    aria-hidden="true"
                  >
                    {{ tutor.teachingLanguages.join(', ') }}
                  </div>
                }
              </div>

              <!-- Card body -->
              <div class="p-4 space-y-3">
                <!-- Tutor name + avatar -->
                <div class="flex items-center gap-3">
                  <img
                    [src]="tutor.avatarUrl"
                    [alt]="'classrooms.avatarAlt' | t: { name: tutor.name }"
                    class="w-10 h-10 rounded-full object-cover ring-2 ring-surface-100 flex-shrink-0"
                    loading="lazy"
                  />
                  <div class="min-w-0">
                    <h3 class="text-sm font-semibold text-text-primary truncate">
                      {{ tutor.name }}
                    </h3>
                    <p class="text-xs text-text-muted truncate">
                      {{ tutor.headline }}
                    </p>
                  </div>
                </div>

                <!-- Star rating -->
                <div class="flex items-center gap-1" [attr.aria-label]="'classrooms.ratingAria' | t: { rating: tutor.rating, count: tutor.reviewCount }">
                  @for (dummy of starArray(tutor.rating); track dummy) {
                    <span class="text-yellow-400 text-sm" aria-hidden="true">
                      {{ 'classrooms.fullStar' | t }}
                    </span>
                  }
                  @for (dummy of emptyStarArray(tutor.rating); track dummy) {
                    <span class="text-gray-500 text-sm" aria-hidden="true">
                      {{ 'classrooms.emptyStar' | t }}
                    </span>
                  }
                  <span class="text-xs text-text-muted ms-1">
                    ({{ tutor.reviewCount }})
                  </span>
                </div>

                <!-- Pricing -->
                <div class="flex items-center justify-between pt-2 border-t border-surface-100">
                  <span class="text-sm font-bold text-primary">
                    {{ 'classrooms.hourlyRate' | t: { gbp: tutor.hourlyRateGbp, usd: tutor.hourlyRateUsd } }}
                  </span>
                  <span
                    class="text-xs px-2 py-1 rounded-full border border-primary/30 text-primary font-medium"
                    aria-hidden="true"
                  >
                    {{ 'classrooms.bookNow' | t }}
                  </span>
                </div>
              </div>
            </app-card>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .aspect-video-thumb {
        aspect-ratio: 16 / 9;
      }
    `,
  ],
})
export class ClassroomsMarketplace {
  readonly tutors = input<readonly ClassroomTutor[]>([]);
  readonly isLoading = input(false);
  readonly isEmpty = computed(() => !this.isLoading() && this.tutors().length === 0);

  /** Generate full-star boolean array from the numeric rating (0-5). */
  starArray(rating: number): Array<boolean> {
    const full = Math.min(5, Math.max(0, Math.floor(rating)));
    return Array.from({ length: full }, () => true);
  }

  /** Generate empty-star boolean array for remaining positions. */
  emptyStarArray(rating: number): Array<boolean> {
    const full = Math.min(5, Math.max(0, Math.floor(rating)));
    return Array.from({ length: 5 - full }, () => true);
  }
}
