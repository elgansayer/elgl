import { Component, computed, inject, resource } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';
import { AppCardComponent } from '../primitives/card/card.component';
import { environment } from '../../../environments/environment';

interface DailyTipResponse {
  tip: string;
}

@Component({
  selector: 'app-daily-learning-tip',
  imports: [TranslatePipe, AppCardComponent],
  template: `
    <app-card
      variant="default"
      padding="md"
      customClass="space-y-2 min-w-0 motion-reduce:transition-none"
      [attr.aria-label]="'home.dailyTip.title' | t"
      [attr.aria-busy]="tipResource.isLoading() ? 'true' : null"
    >
      <h2 class="text-sm uppercase tracking-wider text-text-muted font-medium break-words">
        {{ 'home.dailyTip.title' | t }}
      </h2>
      @if (tipResource.isLoading()) {
        <p class="text-sm text-text-muted break-words">{{ 'home.dailyTip.loading' | t }}</p>
      } @else {
        <p class="text-base text-text-primary break-words [overflow-wrap:anywhere]">{{ tip() }}</p>
      }
    </app-card>
  `,
  styles: [':host { display: block; min-width: 0; }'],
})
export class DailyLearningTipComponent {
  private readonly authService = inject(AuthService);
  private readonly i18nService = inject(I18nService);

  protected readonly tipResource = resource<DailyTipResponse, unknown>({
    loader: () => {
      const token = this.authService.getAccessToken();
      if (!token) {
        return Promise.reject(new Error('No access token available'));
      }
      return fetch(`${environment.apiUrl}/daily-tip`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => {
        if (!r.ok) throw new Error('Failed to fetch daily tip');
        return r.json();
      });
    },
  });

  protected readonly tip = computed(() => {
    if (this.tipResource.error()) {
      return this.i18nService.translate('home.dailyTip.fallback');
    }
    return this.tipResource.value()?.tip ?? this.i18nService.translate('home.dailyTip.fallback');
  });
}
