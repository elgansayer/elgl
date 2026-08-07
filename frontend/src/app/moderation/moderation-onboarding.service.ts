import { inject, Injectable } from '@angular/core';
import { JoyrideService } from 'ngx-joyride';
import { I18nService } from '../services/i18n.service';

export interface ModerationOnboardingStep {
  key: string;
  title: string;
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ModerationOnboardingService {
  private joyrideService = inject(JoyrideService);
  private i18n = inject(I18nService);

  readonly stepKeys: readonly string[] = [
    'stepTypeTabs',
    'stepStatusFilters',
    'stepReportedItems',
    'stepApproveReject',
  ];

  getSteps(): ModerationOnboardingStep[] {
    return this.stepKeys.map((key) => ({
      key,
      title: this.i18n.translate(`moderation.onboarding.${key}.title`),
      text: this.i18n.translate(`moderation.onboarding.${key}.text`),
    }));
  }

  startTour(): void {
    this.joyrideService
      .startTour({
        steps: [...this.stepKeys],
        stepDefaultPosition: 'bottom',
        themeColor: '#1d4ed8',
        showCounter: true,
        showPrevButton: true,
      })
      .subscribe();
  }

  closeTour(): void {
    if (this.joyrideService.isTourInProgress()) {
      this.joyrideService.closeTour();
    }
  }
}