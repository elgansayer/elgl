import { Component, inject } from '@angular/core';
import { from } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserService } from '../../services/user.service';

@Component({
  standalone: true,
  selector: 'app-study-streak-counter',
  template: `
    @if (streakValue() !== undefined) {
      <div class="flex items-center gap-2 ps-3 pe-3 py-2 rounded-lg bg-surface/80">
        <span class="text-sm font-medium text-white">
          {{ streakValue() }} day{{ streakValue() === 1 ? '' : 's' }}
        </span>
      </div>
    } @else {
      <div class="flex items-center gap-2 ps-3 pe-3 py-2">
        <span class="text-sm text-muted-foreground">Loading...</span>
      </div>
    }
  `,
})
export class StudyStreakCounterComponent {
  private userService = inject(UserService);

  private streak$ = from(this.userService.getStudyStreak());
  protected streakValue = toSignal(this.streak$);
}
