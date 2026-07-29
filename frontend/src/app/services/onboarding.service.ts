import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  readonly isOnboardingComplete = signal(false);

  completeOnboarding(): void {
    this.isOnboardingComplete.set(true);
    try {
      window.localStorage.setItem('hellotalk_onboarding_done', 'true');
    } catch {
      // storage unavailable, ignore
    }
  }
}
