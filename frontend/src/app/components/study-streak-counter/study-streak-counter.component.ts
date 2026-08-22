import { Component, inject } from '@angular/core';
import { from } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserService } from '../../services/user.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { LanguageChallengesComponent } from '../language-challenges/language-challenges.component';

@Component({
  standalone: true,
  selector: 'app-study-streak-counter',
  imports: [TranslatePipe, LanguageChallengesComponent],
  template: `
    <section class="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6" aria-label="Current study streak">
      @if (streakValue() !== undefined) {
        <div class="flex items-center gap-2 rounded-lg bg-surface-300/80 px-3 py-2">
          <span class="text-sm font-medium text-text-primary">
            Current study streak: {{ streakValue() }} day{{ streakValue() === 1 ? '' : 's' }}
          </span>
        </div>
      } @else {
        <div class="flex items-center gap-2 px-3 py-2" role="status">
          <span class="text-sm text-text-muted">{{ 'common.loading' | t }}</span>
        </div>
      }
    </section>
    <app-language-challenges />
  `,
})
export class StudyStreakCounterComponent {
  private readonly userService = inject(UserService);

  private readonly streak$ = from(this.userService.getStudyStreak());
  protected readonly streakValue = toSignal(this.streak$);
}
