import { Component, inject } from '@angular/core';
import { from } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '../../services/translate.pipe';
import { UserService } from '../../services/user.service';

@Component({
  standalone: true,
  imports: [TranslatePipe],
  selector: 'app-study-streak-counter',
  template: `
    @if (streakValue() !== undefined) {
      <div class="flex items-center gap-2 ps-3 pe-3 py-2 rounded-app bg-surface-300/80">
        <span class="text-sm font-bold text-text-primary">
          {{ streakValue() }} {{ (streakValue() === 1 ? 'studyStreak.day' : 'studyStreak.days') | t }}
        </span>
      </div>
    } @else {
      <div class="flex items-center gap-2 ps-3 pe-3 py-2">
        <span class="text-sm text-text-muted">{{ 'common.loading' | t }}</span>
      </div>
    }
  `,
})
export class StudyStreakCounterComponent {
  private userService = inject(UserService);

  private streak$ = from(this.userService.getStudyStreak());
  protected streakValue = toSignal(this.streak$);
}
