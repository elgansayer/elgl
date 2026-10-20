import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { OnboardingService } from '../../services/onboarding.service';
import { OnboardingWizardComponent } from './onboarding-wizard.component';
import { vi } from 'vitest';

describe('OnboardingWizardComponent', () => {
  it('should complete onboarding and navigate to ai-conversation on init', () => {
    const onboardingService = {
      completeOnboarding: vi.fn(),
    };
    const router = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: OnboardingService, useValue: onboardingService },
        { provide: Router, useValue: router },
      ],
    });

    const component = TestBed.runInInjectionContext(() => new OnboardingWizardComponent());
    component.ngOnInit();

    expect(onboardingService.completeOnboarding).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith(['/ai-conversation']);
  });
});
