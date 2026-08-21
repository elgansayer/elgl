import { Component, inject, computed, resource, signal, isDevMode } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { StudyStreakService } from '../../services/study-streak.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-study-streak-widget',
  imports: [TranslatePipe, ...HlmButtonImports],
  template: `
    <div class="study-streak-widget flex items-center gap-3 rounded-xl bg-surface-300 ps-4 pe-4 pt-4 pb-4">
      <span class="text-2xl" aria-hidden="true">🔥</span>
      <div class="flex flex-col" aria-live="polite">
        <span class="text-xs text-text-muted">{{ 'studyStreak.daily' | t }}</span>
        @if (streakLoading()) {
          <span class="text-2xl font-bold text-text-muted">{{ 'common.loading' | t }}</span>
        } @else if (streakError()) {
          @if (fallbackStreak() > 0) {
            <span class="text-2xl font-bold text-danger">
              {{ fallbackStreak() }} {{ (fallbackStreak() === 1 ? 'studyStreak.day' : 'studyStreak.days') | t }}
            </span>
          } @else {
            <span class="text-2xl font-bold text-danger">{{ 'common.error' | t }}</span>
          }
        } @else {
          <span class="streak-value text-2xl font-bold text-accent">{{ streakValue() }} {{ dayLabel() | t }}</span>
        }
      </div>
      <button
        hlmBtn
        type="button"
        size="touch"
        class="ms-auto rounded-full bg-gradient-to-r from-accent to-neon-orange shadow-lg hover:opacity-90"
        (click)="checkIn()"
      >
        {{ 'studyStreak.checkin' | t }}
      </button>
    </div>
  `,
  styles: [`:host { display: block; }`],
})
export class StudyStreakWidgetComponent {
  private streakService = inject(StudyStreakService);
  private refreshTrigger = signal(0);

  private streakResource = resource({
    params: () => ({ refresh: this.refreshTrigger() }),
    loader: () => firstValueFrom(this.streakService.getStreak()).then((response) => response.streak),
  });

  readonly streakLoading = computed(() => this.streakResource.isLoading());
  readonly streakError = computed(() => this.streakResource.error());
  readonly streakValue = computed(() => (this.streakResource.error() ? 0 : (this.streakResource.value() ?? 0)));
  readonly fallbackStreak = computed<number>(() => (isDevMode() ? 7 : 0));
  readonly dayLabel = computed(() => this.streakValue() === 1 ? 'studyStreak.day' : 'studyStreak.days');

  async checkIn(): Promise<void> {
    try {
      await firstValueFrom(this.streakService.checkin());
      this.refreshTrigger.update((value) => value + 1);
    } catch (error) {
      console.error('Failed to check in study streak', error);
    }
  }
}
