import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { I18nService } from '../../services/i18n.service';
import { OnboardingService } from '../../services/onboarding.service';
import { OnboardingWizardComponent } from './onboarding-wizard.component';
import { vi } from 'vitest';

describe('OnboardingWizardComponent', () => {
  it('should continue to discovery after completing onboarding', () => {
    const isOnboardingComplete = signal(false);
    const onboardingService = {
      nextStep: vi.fn(() => isOnboardingComplete.set(true)),
      isOnboardingComplete,
    };
    const router = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: OnboardingService, useValue: onboardingService },
        { provide: Router, useValue: router },
        { provide: I18nService, useValue: {} },
      ],
    });

    const component = TestBed.runInInjectionContext(() => new OnboardingWizardComponent());
    component.handleNext();

    expect(onboardingService.nextStep).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith(['/discovery']);
  });

  it('should stay on the wizard while another onboarding step remains', () => {
    const onboardingService = {
      nextStep: vi.fn(),
      isOnboardingComplete: signal(false),
    };
    const router = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: OnboardingService, useValue: onboardingService },
        { provide: Router, useValue: router },
        { provide: I18nService, useValue: {} },
      ],
    });

    const component = TestBed.runInInjectionContext(() => new OnboardingWizardComponent());
    component.handleNext();

    expect(onboardingService.nextStep).toHaveBeenCalledOnce();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
