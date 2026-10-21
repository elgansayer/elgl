import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { OnboardingWizardComponent } from './onboarding-wizard.component';
import { OnboardingService } from '../../services/onboarding.service';
import { I18nService } from '../../services/i18n.service';
import { provideHttpClient } from '@angular/common/http';

describe('OnboardingWizardComponent', () => {
  let component: OnboardingWizardComponent;
  let fixture: ComponentFixture<OnboardingWizardComponent>;
  let router: Router;
  let onboardingService: Partial<OnboardingService>;

  beforeEach(async () => {
    onboardingService = {
      steps: [{ label: 'test' }],
      currentStep: signal(0),
      canGoNext: signal(true),
      isOnboardingComplete: signal(true),
      nextStep: vi.fn(),
      primaryTargetLanguage: signal('en'),
      quizResult: signal(null),
    };

    await TestBed.configureTestingModule({
      imports: [OnboardingWizardComponent],
      providers: [
        provideHttpClient(),
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: OnboardingService, useValue: onboardingService },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key, currentLang: signal('en-GB') },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(OnboardingWizardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('navigates to /discovery when onboarding is complete', () => {
    component.handleNext();
    expect(router.navigate).toHaveBeenCalledWith(['/discovery']);
  });
});
