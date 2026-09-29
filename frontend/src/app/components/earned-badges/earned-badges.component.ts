import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-earned-badges',
  imports: [TranslatePipe],
  template: `
    <div class="flex flex-wrap gap-2">
      @if (badges()?.isVip) {
        <span
          class="inline-flex items-center rounded-full bg-gradient-to-r from-vip to-accent px-3 py-1 text-xs font-semibold text-on-fill"
        >
          <span class="me-1">👑</span>
          {{ 'badges.vip' | t }}
        </span>
      }
      @if (badges()?.isSeriousLearner) {
        <span
          class="inline-flex items-center rounded-full bg-gradient-to-r from-secondary to-success px-3 py-1 text-xs font-semibold text-on-fill"
        >
          <span class="me-1">🎓</span>
          {{ 'badges.seriousLearner' | t }}
        </span>
      }
      @if (!badges()?.isVip && !badges()?.isSeriousLearner) {
        <span class="text-xs text-text-muted">
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
