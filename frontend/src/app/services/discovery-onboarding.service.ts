import { Injectable, signal, inject } from '@angular/core';
import { JoyrideService } from 'ngx-joyride';
import { I18nService } from './i18n.service';

export interface DiscoveryOnboardingStep {
  key: string;
  title: string;
  text: string;
}

/**
 * Manages the onboarding tour state for the Discovery Map feature.
 * Steps correspond to `joyrideStep` directive names in the template.
 */
@Injectable({ providedIn: 'root' })
export class DiscoveryOnboardingService {
  private readonly joyrideService = inject(JoyrideService);
  private readonly i18n = inject(I18nService);
  private readonly storageKey = 'hellotalk_discovery_onboarding_done';

  /** Whether the discovery onboarding tour is in progress. */
  readonly isTourInProgress = signal(false);

  /** Step names registered with the JoyrideDirective in the DiscoveryComponent. */
  readonly steps: DiscoveryOnboardingStep[] = [
    {
      key: 'discoveryStepTitle',
      title: 'Find Partners',
      text: 'Welcome to the Discovery Map. Find language partners based on your goals and preferences.',
    },
    {
      key: 'discoveryStepFilterPills',
      title: 'Quick Filters',
      text: 'Use these filter pills to quickly switch between All Users, Serious Learners, Nearby partners, and Paid Practice.',
    },
    {
      key: 'discoveryStepLanguagePills',
      title: 'Language Filters',
      text: 'Tap a language chip to filter partners by target language, or use the language picker to search for more languages.',
    },
    {
      key: 'discoveryStepSortGender',
      title: 'Sort & Gender',
      text: 'Sort results by best match, online status, or distance. VIP users can also filter by gender.',
    },
    {
      key: 'discoveryStepAgeDistance',
      title: 'Age & Distance',
      text: 'Adjust the age range and distance radius to narrow down your partner search. VIP users can fine-tune distance control.',
    },
    {
      key: 'discoveryStepGlobalSearch',
      title: 'Global Search',
      text: 'Use the global search bar to search partners by name, native language, target language, or proficiency level.',
    },
    {
      key: 'discoveryStepPartnerCards',
      title: 'Partner Cards',
      text: 'Browse partner cards showing display names, VIP badges, personality types, fluency indicators, and shared interests. Tap a card to start a chat.',
    },
  ];

  get stepNames(): string[] {
    return this.steps.map((s) => s.key);
  }

  startTour(): void {
    if (this.joyrideService.isTourInProgress()) {
      return;
    }

    this.isTourInProgress.set(true);

    this.joyrideService.startTour({
      steps: this.stepNames,
      stepDefaultPosition: 'bottom',
      themeColor: '#6366f1',
      showCounter: true,
      showPrevButton: true,
      customTexts: {
        prev: this.i18n.translate('tour.prev'),
        next: this.i18n.translate('tour.next'),
        done: this.i18n.translate('tour.done'),
        close: this.i18n.translate('tour.close'),
      },
    }).subscribe({
      complete: () => {
        this.markComplete();
      },
      error: () => {
        this.isTourInProgress.set(false);
      },
    });
  }

  markComplete(): void {
    this.isTourInProgress.set(false);
    try {
      window.localStorage.setItem(this.storageKey, 'true');
    } catch {
      // storage unavailable, ignore
    }
  }

  isCompleted(): boolean {
    try {
      return window.localStorage.getItem(this.storageKey) === 'true';
    } catch {
      return false;
    }
  }
}