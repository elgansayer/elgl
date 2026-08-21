import { Component, effect, inject, resource, signal } from '@angular/core';
import { RouterModule } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { StudyStreakWidgetComponent } from '../../components/study-streak-widget/study-streak-widget.component';
import { WordOfTheDayComponent } from '../../components/word-of-the-day/word-of-the-day.component';
import { DailyLearningTipComponent } from '../../components/daily-learning-tip/daily-learning-tip.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { UserService } from '../../services/user.service';
import { StreakMilestoneService } from '../../services/streak-milestone.service';
import { StreakCelebrationOverlayComponent } from '../../components/streak-celebration-overlay/streak-celebration-overlay.component';

@Component({
  selector: 'app-home',
  imports: [
    RouterModule,
    StudyStreakWidgetComponent,
    WordOfTheDayComponent,
    DailyLearningTipComponent,
    TranslatePipe,
    StreakCelebrationOverlayComponent,
  ],
  template: `
    <div class="min-h-screen bg-surface-500 text-text-primary">
      <header class="py-4 ps-4 pe-4 border-b border-surface-100 flex items-center justify-between">
        <h1 class="text-xl font-bold">{{ 'home.title' | t }}</h1>
        <div class="flex items-center gap-4">
          <a
            routerLink="/leaderboard"
            class="text-sm text-primary hover:text-primary/80 transition-colors"
            [attr.aria-label]="'nav.leaderboard' | t"
          >
            {{ 'nav.leaderboard' | t }}
          </a>
          <span class="text-sm text-text-muted">
            {{ authService.currentUser()?.email }}
          </span>
        </div>
      </header>

      <main class="py-4 ps-4 pe-4 space-y-4">
        <app-study-streak-widget></app-study-streak-widget>
        <app-word-of-the-day></app-word-of-the-day>
        <app-daily-learning-tip></app-daily-learning-tip>
      </main>

      <app-streak-celebration-overlay></app-streak-celebration-overlay>
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
export class HomeComponent {
  readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly streakMilestoneService = inject(StreakMilestoneService);
  private readonly previousStreak = signal<number>(0);
  private readonly celebratedMilestones = signal<Set<number>>(new Set());

  private readonly streakResource = resource({
    loader: () => this.userService.getStudyStreak(),
  });

  constructor() {
    effect(() => {
      if (this.streakResource.error()) {
        return;
      }
      const current = this.streakResource.value();
      if (current === null || current === undefined) {
        return;
      }
      const previous = this.previousStreak();
      const milestones = [7, 30, 100];
      if (
        milestones.includes(current) &&
        current > previous &&
        !this.celebratedMilestones().has(current)
      ) {
        this.streakMilestoneService.celebrate(current);
        const updated = new Set(this.celebratedMilestones());
        updated.add(current);
        this.celebratedMilestones.set(updated);
      }
      this.previousStreak.set(current);
    });
  }
}
