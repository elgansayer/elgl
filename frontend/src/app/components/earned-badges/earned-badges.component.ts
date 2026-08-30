import { Component, computed, inject } from '@angular/core';
import { AppPillComponent } from '../primitives/pill/pill.component';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-earned-badges',
  imports: [AppPillComponent, TranslatePipe],
  template: `
    <div class="flex min-w-0 max-w-full flex-wrap items-center gap-2">
      @if (badges()?.isVip) {
        <app-pill colour="vip" size="sm">
          <span aria-hidden="true" class="me-1 shrink-0">👑</span>
          <span class="min-w-0 break-words">{{ 'badges.vip' | t }}</span>
        </app-pill>
      }
      @if (badges()?.isSeriousLearner) {
        <app-pill colour="primary" size="sm">
          <span aria-hidden="true" class="me-1 shrink-0">🎓</span>
          <span class="min-w-0 break-words">{{ 'badges.seriousLearner' | t }}</span>
        </app-pill>
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
}
