import { Injectable, signal } from '@angular/core';

export interface MatchmakingOnboardingStep {
  key: string;
  title: string;
  text: string;
}

/**
 * Manages the onboarding tour state for the Matchmaking Algorithm feature.
 * Provides step definitions that describe how the discovery and matching
 * system scores, ranks, filters, and presents language partners.
 */
@Injectable({ providedIn: 'root' })
export class MatchmakingOnboardingService {
  private readonly storageKey = 'hellotalk_matchmaking_onboarding_done';

  readonly isTourInProgress = signal(false);

  readonly steps: MatchmakingOnboardingStep[] = [
    {
      key: 'matchmakingStepOverview',
      title: 'matchmaking.onboarding.overviewTitle',
      text: 'matchmaking.onboarding.overviewText',
    },
    {
      key: 'matchmakingStepFilterPills',
      title: 'matchmaking.onboarding.filterPillsTitle',
      text: 'matchmaking.onboarding.filterPillsText',
    },
    {
      key: 'matchmakingStepLanguagePills',
      title: 'matchmaking.onboarding.languagePillsTitle',
      text: 'matchmaking.onboarding.languagePillsText',
    },
    {
      key: 'matchmakingStepSortGender',
      title: 'matchmaking.onboarding.sortGenderTitle',
      text: 'matchmaking.onboarding.sortGenderText',
    },
    {
      key: 'matchmakingStepAgeDistance',
      title: 'matchmaking.onboarding.ageDistanceTitle',
      text: 'matchmaking.onboarding.ageDistanceText',
    },
    {
      key: 'matchmakingStepGlobalSearch',
      title: 'matchmaking.onboarding.globalSearchTitle',
      text: 'matchmaking.onboarding.globalSearchText',
    },
    {
      key: 'matchmakingStepPartnerCards',
      title: 'matchmaking.onboarding.partnerCardsTitle',
      text: 'matchmaking.onboarding.partnerCardsText',
    },
    {
      key: 'matchmakingStepSeriousMode',
      title: 'matchmaking.onboarding.seriousModeTitle',
      text: 'matchmaking.onboarding.seriousModeText',
    },
  ];

  get stepNames(): string[] {
    return this.steps.map((s) => s.key);
  }

  startTour(): void {
    this.isTourInProgress.set(true);
  }

  closeTour(): void {
    this.isTourInProgress.set(false);
  }

  markComplete(): void {
    this.isTourInProgress.set(false);
    try {
      window.localStorage.setItem(this.storageKey, 'true');
    } catch (e) {
      console.error(e);
    }
  }

  isCompleted(): boolean {
    try {
      return window.localStorage.getItem(this.storageKey) === 'true';
    } catch {
      return false;
    }
  }

  /** Reset onboarding flag - useful for testing or re-enabling tours. */
  reset(): void {
    this.isTourInProgress.set(false);
    try {
      window.localStorage.removeItem(this.storageKey);
    } catch (e) {
      console.error(e);
    }
  }
}