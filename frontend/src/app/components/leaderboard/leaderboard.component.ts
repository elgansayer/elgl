import { Component, inject, computed, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppPillComponent } from '../primitives/pill/pill.component';
import { TranslatePipe } from '../../services/translate.pipe';

interface WeeklyLeaderboardEntry {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  score: number;
}

interface WeeklyLeaderboard {
  correctors: WeeklyLeaderboardEntry[];
  study_hours: WeeklyLeaderboardEntry[];
}

@Component({
  selector: 'app-leaderboard',
  imports: [AppCardComponent, AppPillComponent, TranslatePipe],
  template: `
    <div class="max-w-2xl mx-auto ps-4 pe-4 pt-6 pb-6">
      <h1 class="text-2xl font-bold mb-1">{{ 'leaderboard.weekly_title' | t }}</h1>
      <p class="text-sm text-text-secondary mb-4">{{ 'leaderboard.week_reset' | t }}</p>

      @if (isLoading()) {
        <p class="text-text-secondary">{{ 'common.loading' | t }}</p>
      } @else if (error(); as err) {
        <p class="text-danger-ink">{{ 'common.error' | t }}: {{ err }}</p>
      } @else {
        <section class="mb-8" aria-labelledby="weekly-correctors-heading">
          <h2 id="weekly-correctors-heading" class="text-lg font-semibold mb-3">
            {{ 'leaderboard.weekly_correctors' | t }}
          </h2>
          <div class="space-y-3">
            @for (entry of correctors(); track entry.user_id; let i = $index) {
              <app-card variant="elevated" padding="md">
                <div class="flex items-center gap-4">
                  <span class="text-lg font-bold text-primary-ink w-8">{{ i + 1 }}</span>
                  <div class="flex-shrink-0 w-10 h-10 rounded-full bg-surface-100 overflow-hidden">
                    @if (entry.avatar_url; as avatar) {
                      <img
                        [src]="avatar"
                        alt=""
                        width="40"
                        height="40"
                        loading="lazy"
                        decoding="async"
                        class="w-full h-full object-cover"
                      />
                    } @else {
                      <div
                        class="w-full h-full flex items-center justify-center text-text-secondary text-sm"
                      >
                        {{ (entry.display_name ?? ('leaderboard.anonymous' | t)).charAt(0) }}
                      </div>
                    }
                  </div>
                  <p class="flex-1 min-w-0 font-semibold truncate">
                    {{ entry.display_name ?? ('leaderboard.anonymous' | t) }}
                  </p>
                  <app-pill
                    colour="info"
                    size="sm"
                    [label]="entry.score + ' ' + ('leaderboard.corrections' | t)"
                  />
                </div>
              </app-card>
            } @empty {
              <p class="text-text-secondary">{{ 'leaderboard.empty_correctors' | t }}</p>
            }
          </div>
        </section>

        <section aria-labelledby="weekly-study-hours-heading">
          <h2 id="weekly-study-hours-heading" class="text-lg font-semibold mb-3">
            {{ 'leaderboard.weekly_study_hours' | t }}
          </h2>
          <div class="space-y-3">
            @for (entry of studyHours(); track entry.user_id; let i = $index) {
              <app-card variant="elevated" padding="md">
                <div class="flex items-center gap-4">
                  <span class="text-lg font-bold text-primary-ink w-8">{{ i + 1 }}</span>
                  <div class="flex-shrink-0 w-10 h-10 rounded-full bg-surface-100 overflow-hidden">
                    @if (entry.avatar_url; as avatar) {
                      <img
                        [src]="avatar"
                        alt=""
                        width="40"
                        height="40"
                        loading="lazy"
                        decoding="async"
                        class="w-full h-full object-cover"
                      />
                    } @else {
                      <div
                        class="w-full h-full flex items-center justify-center text-text-secondary text-sm"
                      >
                        {{ (entry.display_name ?? ('leaderboard.anonymous' | t)).charAt(0) }}
                      </div>
                    }
                  </div>
                  <p class="flex-1 min-w-0 font-semibold truncate">
                    {{ entry.display_name ?? ('leaderboard.anonymous' | t) }}
                  </p>
                  <app-pill
                    colour="success"
                    size="sm"
                    [label]="entry.score + ' ' + ('leaderboard.hours' | t)"
                  />
                </div>
              </app-card>
            } @empty {
              <p class="text-text-secondary">{{ 'leaderboard.empty_study_hours' | t }}</p>
            }
          </div>
        </section>
      }
    </div>
  `,
})
export class LeaderboardComponent {
  private http = inject(HttpClient);

  readonly weeklyResource = resource({
    loader: () =>
      firstValueFrom(
        this.http.get<WeeklyLeaderboard>(
          `${environment.apiUrl}/leaderboard/weekly?limit=20`,
        ),
      ),
  });

  readonly isLoading = computed(() => this.weeklyResource.isLoading());
  readonly error = computed(() => {
    const e = this.weeklyResource.error();
    if (!e) return null;
    if (typeof e === 'string') return e;
    if (e instanceof Error) return e.message;
    return 'Unknown error';
  });
  readonly correctors = computed(
    () => this.weeklyResource.value()?.correctors ?? [],
  );
  readonly studyHours = computed(
    () => this.weeklyResource.value()?.study_hours ?? [],
  );
}
