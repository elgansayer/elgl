import { Component, inject, computed, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppPillComponent } from '../primitives/pill/pill.component';
import { TranslatePipe } from '../../services/translate.pipe';

interface Corrector {
  id: string;
  display_name: string;
  avatar_url: string | null;
  correction_ratio: number;
  study_streak_days: number;
  is_serious_learner: boolean;
}

@Component({
  selector: 'app-leaderboard',
  imports: [AppCardComponent, AppPillComponent, TranslatePipe],
  template: `
    <div class="max-w-2xl mx-auto ps-4 pe-4 pt-6 pb-6">
      <h1 class="text-2xl font-bold mb-4">{{ 'leaderboard.top_correctors' | t }}</h1>

      @if (isLoading()) {
        <p class="text-text-secondary">{{ 'common.loading' | t }}</p>
      } @else if (error(); as err) {
        <p class="text-danger">{{ 'common.error' | t }}: {{ err }}</p>
      } @else {
        <div class="space-y-3">
          @for (corrector of correctors(); track corrector.id; let i = $index) {
            <app-card variant="elevated" padding="md">
              <div class="flex items-center gap-4">
                <span class="text-lg font-bold text-primary w-8">{{ i + 1 }}</span>
                <div class="flex-shrink-0 w-10 h-10 rounded-full bg-surface-100 overflow-hidden">
                  @if (corrector.avatar_url; as avatar) {
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
                      {{ corrector.display_name.charAt(0) }}
                    </div>
                  }
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold truncate">{{ corrector.display_name }}</p>
                  <p class="text-sm text-text-secondary">
                    {{ 'leaderboard.ratio' | t }}: {{ corrector.correction_ratio.toFixed(2) }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  @if (corrector.is_serious_learner) {
                    <app-pill colour="success" size="sm" [label]="'leaderboard.serious' | t" />
                  }
                  <app-pill colour="info" size="sm" [label]="corrector.study_streak_days + ' ' + ('leaderboard.days' | t)" />
                </div>
              </div>
            </app-card>
          } @empty {
            <p class="text-text-secondary">{{ 'leaderboard.empty' | t }}</p>
          }
        </div>
      }
    </div>
  `,
})
export class LeaderboardComponent {
  private http = inject(HttpClient);

  readonly correctorsResource = resource({
    loader: () =>
      firstValueFrom(
        this.http.get<Corrector[]>(`${environment.apiUrl}/leaderboard/top-correctors?limit=20`),
      ),
  });

  readonly isLoading = computed(() => this.correctorsResource.isLoading());
  readonly error = computed(() => {
    const e = this.correctorsResource.error();
    if (!e) return null;
    if (typeof e === 'string') return e;
    if (e instanceof Error) return e.message;
    return 'Unknown error';
  });
  readonly correctors = computed(() => this.correctorsResource.value() ?? []);
}
