import { Component, inject, AfterViewInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { JoyrideModule, JoyrideService, JoyrideOptions } from 'ngx-joyride';
import { EconomyStore } from '../../services/economy.store';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { CoinEconomyOnboardingService } from '../../services/coin-economy-onboarding.service';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppPillComponent } from '../primitives/pill/pill.component';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';

@Component({
  selector: 'app-coin-economy-dashboard',
  standalone: true,
  imports: [
    TranslatePipe,
    RouterLink,
    DecimalPipe,
    JoyrideModule,
    AppCardComponent,
    AppPillComponent,
    AppButtonPrimaryComponent,
  ],
  templateUrl: './coin-economy-dashboard.component.html',
})
export class CoinEconomyDashboardComponent implements AfterViewInit {
  readonly economyStore = inject(EconomyStore);
  private readonly i18n = inject(I18nService);
  private readonly joyrideService = inject(JoyrideService);
  private readonly onboardingService = inject(CoinEconomyOnboardingService);

  readonly balance = this.economyStore.coinsBalance;

  ngAfterViewInit(): void {
    void this.economyStore.loadInitialData();
    this.maybeStartTour();
  }

  private maybeStartTour(): void {
    if (this.onboardingService.isCompleted()) {
      return;
    }
    if (this.onboardingService.isTourInProgress()) {
      return;
    }
    this.onboardingService.isTourInProgress.set(true);

    setTimeout(() => {
      const options: JoyrideOptions = {
        steps: this.onboardingService.stepNames,
        startWith: 'coinEconomyStepBalance',
        waitingTime: 100,
        stepDefaultPosition: 'bottom',
        themeColor: '#6366f1',
        showCounter: true,
        showPrevButton: true,
      };

      this.joyrideService.startTour(options).subscribe({
        error: () => {
          this.onboardingService.isTourInProgress.set(false);
        },
        complete: () => {
          this.onboardingService.markComplete();
        },
      });
    }, 500);
  }

  async claimDailyReward(): Promise<void> {
    await this.economyStore.claimDailyCheckIn();
  }

  startTour(): void {
    this.onboardingService.reset();
    this.maybeStartTour();
  }
}