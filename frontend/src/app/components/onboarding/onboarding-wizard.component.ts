import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { OnboardingService } from '../../services/onboarding.service';

@Component({
  selector: 'app-onboarding-wizard',
  imports: [],
  template: '',
  styles: [],
})
export class OnboardingWizardComponent implements OnInit {
  private readonly router = inject(Router);
  readonly onboardingService = inject(OnboardingService);

  ngOnInit(): void {
    this.onboardingService.completeOnboarding();
    void this.router.navigate(['/ai-conversation']);
  }
}
