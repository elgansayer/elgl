import { Component, inject, computed, resource, signal, isDevMode } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StudyStreakService } from '../../services/study-streak.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-study-streak-widget',
  imports: [TranslatePipe],
  template: `
    <div
      class="study-streak-widget bg-surface-300 rounded-xl ps-4 pe-4 pt-4 pb-4 flex items-center gap-3"
    >
      <span class="text-2xl" aria-hidden="true">🔥</span>
      <div class="flex flex-col" aria-live="polite">
        <span class="text-xs text-text-muted">{{ 'studyStreak.daily' | t }}</span>
        @if (streakLoading()) {
          <span class="text-2xl font-bold text-text-muted">{{ 'common.loading' | t }}</span>
        } @else if (streakError()) {
          @if (fallbackStreak() > 0) {
            <span class="text-2xl font-bold text-danger"
              >{{ fallbackStreak() }}
              {{ (fallbackStreak() === 1 ? 'studyStreak.day' : 'studyStreak.days') | t }}</span
            >
          } @else {
            <span class="text-2xl font-bold text-danger">{{ 'common.error' | t }}</span>
          }
        } @else {
          <span class="streak-value text-2xl font-bold text-accent"
            >{{ streakValue() }} {{ dayLabel() | t }}</span
          >
        }
      </div>
      <button
        (click)="checkIn()"
        class="ms-auto bg-gradient-to-r from-accent to-neon-orange hover:opacity-90 text-on-fill font-semibold py-2 ps-4 pe-4 rounded-full text-sm transition-all duration-200 shadow-lg"
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
  private refreshTrigger = signal(0);

  private streakResource = resource({
    params: () => ({ refresh: this.refreshTrigger() }),
    loader: () => firstValueFrom(this.streakService.getStreak()).then((res) => res.streak),
  });

  readonly streakLoading = computed(() => this.streakResource.isLoading());
  readonly streakError = computed(() => this.streakResource.error());

  readonly streakValue = computed(() => {
    if (this.streakResource.error()) {
      return 0;
    }
    return this.streakResource.value() ?? 0;
  });

  /** Fallback for development and offline scenarios (Fake Data First) */
  readonly fallbackStreak = computed<number>(() => (isDevMode() ? 7 : 0));

  readonly dayLabel = computed(() =>
    this.streakValue() === 1 ? 'studyStreak.day' : 'studyStreak.days',
  );

  async checkIn(): Promise<void> {
    try {
      await firstValueFrom(this.streakService.checkin());
      this.refreshTrigger.update((v) => v + 1);
    } catch (error) {
      console.error('Failed to check in study streak', error);
    }
  }
}
