import { Component, inject, input, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { TranslatePipe } from '../services/translate.pipe';
import { AppCardComponent } from '../components/primitives/card/card.component';

interface FullAchievementDto {
  code: string;
  name: string;
  description: string;
  current: number;
  required: number;
  earned: boolean;
}

@Component({
  selector: 'app-achievements',
  imports: [TranslatePipe, AppCardComponent],
  template: `
    <app-card customClass="app-padded" aria-labelledby="achievements-heading">
      <h2 id="achievements-heading" class="app-section-title">{{ 'achievements.title' | t }}</h2>

      <div class="mt-3" role="status" aria-live="polite">
        @if (achievementsResource.isLoading()) {
          <p class="app-muted">{{ 'achievements.loading' | t }}</p>
        } @else if (achievementsResource.error()) {
          <p class="text-sm text-danger" role="alert">{{ 'achievements.loadError' | t }}</p>
        } @else if (achievementsResource.value().length === 0) {
          <p class="app-muted">{{ 'achievements.empty' | t }}</p>
        } @else {
          <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2" role="list">
            @for (ach of achievementsResource.value(); track ach.code) {
              <li
                class="flex items-center gap-3 rounded-card border border-surface-100 bg-surface-300 p-3"
              >
                <div
                  class="shrink-0 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                  [class.bg-surface-100]="!ach.earned"
                  [class.bg-primary]="ach.earned"
                >
                  @if (ach.earned) {
                    <span class="text-on-fill" aria-hidden="true">&#9733;</span>
                  } @else {
                    <span class="text-text-secondary" aria-hidden="true">&#9723;</span>
                  }
                  <span class="sr-only">{{
                    (ach.earned ? 'achievements.earnedLabel' : 'achievements.lockedLabel') | t
                  }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-text-primary">{{ ach.name }}</p>
                  <p class="truncate text-xs text-text-secondary">{{ ach.description }}</p>
                  <div class="mt-1.5">
                    <div
                      class="h-1.5 w-full overflow-hidden rounded-pill bg-surface-100"
                      role="progressbar"
                      [attr.aria-label]="ach.name"
                      [attr.aria-valuemin]="0"
                      [attr.aria-valuemax]="ach.required || ach.current"
                      [attr.aria-valuenow]="ach.current"
                    >
                      <div
                        class="h-full rounded-pill bg-primary"
                        [style.width.%]="progressPercent(ach)"
                      ></div>
                    </div>
                    <span class="mt-1 block text-xs text-text-secondary">
                      {{
                        'achievements.progressLabel'
                          | t: { current: ach.current, required: ach.required }
                      }}
                    </span>
                  </div>
                </div>
              </li>
            }
          </ul>
        }
      </div>
    </app-card>
  `,
})
export class AchievementsComponent {
  private readonly http = inject(HttpClient);

  readonly userId = input.required<string>();

  readonly achievementsResource = resource({
    params: () => ({ userId: this.userId() }),
    loader: ({ params }) => {
      return firstValueFrom(
        this.http.get<FullAchievementDto[]>(
          `${environment.apiUrl}/achievements/full/${params.userId}`,
        ),
      );
    },
    defaultValue: [],
  });

  progressPercent(ach: FullAchievementDto): number {
    if (!ach.required) {
      return ach.earned ? 100 : 0;
    }
    return Math.min(100, Math.round((ach.current / ach.required) * 100));
  }
}
