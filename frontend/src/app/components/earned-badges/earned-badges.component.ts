import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../services/translate.pipe';

// Read-only status badges built on Relay tokens (the app-pill primitive is retired).
const BADGE_BASE =
  'inline-flex max-w-full min-w-0 items-center justify-center whitespace-normal break-words text-center font-extrabold rounded-pill ps-2 pe-2 py-0.5 text-xs text-on-fill';

@Component({
  selector: 'app-earned-badges',
  imports: [TranslatePipe],
  template: `
    <div class="flex min-w-0 max-w-full flex-wrap items-center gap-2">
      @if (badges()?.isVip) {
        <span data-badge="vip" [class]="vipClasses">
          <span aria-hidden="true" class="me-1 shrink-0">👑</span>
          <span class="min-w-0 break-words">{{ 'badges.vip' | t }}</span>
        </span>
      }
      @if (badges()?.isSeriousLearner) {
        <span data-badge="serious-learner" [class]="learnerClasses">
          <span aria-hidden="true" class="me-1 shrink-0">🎓</span>
          <span class="min-w-0 break-words">{{ 'badges.seriousLearner' | t }}</span>
        </span>
      }
      @if (!badges()?.isVip && !badges()?.isSeriousLearner) {
        <span class="min-w-0 max-w-full break-words text-xs text-text-muted">
          {{ 'badges.none' | t }}
        </span>
      }
    </div>
  `,
})
export class EarnedBadgesComponent {
  private authService = inject(AuthService);
  protected readonly badges = computed(() => this.authService.earnedBadges());
  protected readonly vipClasses = `${BADGE_BASE} bg-vip`;
  protected readonly learnerClasses = `${BADGE_BASE} bg-primary`;
}
