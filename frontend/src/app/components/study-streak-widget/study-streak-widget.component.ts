import { Component, inject, computed, resource, signal, isDevMode } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';
import { StudyStreakService } from '../../services/study-streak.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-study-streak-widget',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div
      class="study-streak-widget bg-[#121212] rounded-xl ps-4 pe-4 pt-4 pb-4 flex items-center gap-3"
    >
      <span class="text-2xl">🔥</span>
      <div class="flex flex-col">
        <span class="text-xs text-gray-400">{{ 'studyStreak.daily' | t }}</span>
        @if (streakLoading()) {
          <span class="text-2xl font-bold text-gray-500">{{ 'common.loading' | t }}</span>
        } @else if (streakError()) {
          @if (fallbackStreak() > 0) {
            <span class="text-2xl font-bold text-red-400"
              >{{ fallbackStreak() }} {{ (fallbackStreak() === 1 ? 'studyStreak.day' : 'studyStreak.days') | t }}</span
            >
          } @else {
            <span class="text-2xl font-bold text-red-400">{{ 'common.error' | t }}</span>
          }
        } @else {
          <span class="text-2xl font-bold text-yellow-400"
            >{{ streakValue() }} {{ dayLabel() | t }}</span
          >
        }
      </div>
      <button
        (click)="checkIn()"
        class="ms-auto bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-white font-semibold py-2 px-4 rounded-full text-sm transition-all duration-200 shadow-lg"
      >
        {{ 'studyStreak.checkin' | t }}
      </button>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class StudyStreakWidgetComponent {
  private streakService = inject(StudyStreakService);
  private i18nService = inject(I18nService);
  private refreshTrigger = signal(0);

  private streakResource = resource({
    request: () => ({ refresh: this.refreshTrigger() }),
    loader: () =>
      firstValueFrom(
        this.streakService.getStreak().pipe(map((res) => res.streak)),
      ),
  });

  readonly streakLoading = computed(() => this.streakResource.isLoading());
  readonly streakError = computed(() => this.streakResource.error());

  readonly streakValue = computed(() => this.streakResource.value() ?? 0);

  /** Fallback for development and offline scenarios (Fake Data First) */
  readonly fallbackStreak = computed(() => (isDevMode() ? 7 : 0));

  readonly dayLabel = computed(() =>
    this.streakValue() === 1 ? 'studyStreak.day' : 'studyStreak.days',
  );

  async checkIn(): Promise<void> {
    try {
      await firstValueFrom(this.streakService.checkin());
      this.refreshTrigger.update((v) => v + 1);
    } catch {
      // error handling can be added later
    }
  }
}
