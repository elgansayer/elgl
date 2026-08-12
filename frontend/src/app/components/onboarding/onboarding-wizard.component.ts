import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { OnboardingService } from '../../services/onboarding.service';
import { I18nService } from '../../services/i18n.service';
import { DiagnosticQuizComponent } from '../diagnostic-quiz/diagnostic-quiz.component';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';

@Component({
  selector: 'app-onboarding-wizard',
  imports: [
    CommonModule,
    TranslatePipe,
    DiagnosticQuizComponent,
    AppButtonPrimaryComponent,
    AppButtonSecondaryComponent,
  ],
  template: `
    <div class="onboarding-wizard bg-surface-500 text-text-primary ps-4 pe-4 pt-6 pb-6">
      <h1 class="text-xl font-bold">{{ 'onboarding.title' | t }}</h1>
      <p class="text-sm opacity-80">{{ 'onboarding.subtitle' | t }}</p>

      <!-- step progress indicators -->
      <div class="mt-4 flex flex-wrap gap-2">
        @for (step of onboardingService.steps; track $index) {
          <div
            class="flex items-center gap-2 p-2 rounded"
            [class.bg-accent/20]="onboardingService.currentStep() === $index"
          >
            <span
              class="w-6 h-6 flex items-center justify-center rounded-full bg-surface-200 text-sm"
            >
              {{ $index + 1 }}
            </span>
            <span>{{ step.label | t }}</span>
          </div>
        }
      </div>

      <!-- step 0: native language -->
      @if (onboardingService.currentStep() === 0) {
        <div class="mt-4">
          <label class="block text-sm mb-1" for="native-lang">{{
            'onboarding.step1.label' | t
          }}</label>
          <select
            id="native-lang"
            class="w-full bg-surface-200 border border-surface-100 text-text-primary p-2 rounded"
            [value]="onboardingService.nativeLanguage()"
            (change)="onNativeLanguageChange($event)"
          >
            <option value="">{{ 'onboarding.step1.placeholder' | t }}</option>
            @for (lang of i18n.availableLanguages; track lang.code) {
              <option [value]="lang.code">{{ lang.flag }} {{ lang.nativeName }}</option>
            }
          </select>
        </div>
      }

      <!-- step 1: target languages -->
      @if (onboardingService.currentStep() === 1) {
        <div class="mt-4">
          <span class="block text-sm mb-1">{{ 'onboarding.step2.label' | t }}</span>
          <div class="grid grid-cols-1 gap-2">
            @for (lang of i18n.availableLanguages; track lang.code) {
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  [checked]="onboardingService.targetLanguages().has(lang.code)"
                  (change)="onboardingService.toggleTargetLanguage(lang.code)"
                />
                <span>{{ lang.flag }} {{ lang.nativeName }}</span>
              </label>
            }
          </div>
        </div>
      }

      <!-- step 2: diagnostic quiz -->
      @if (onboardingService.currentStep() === 2) {
        <div class="mt-4">
          <app-diagnostic-quiz
            [targetLanguage]="firstTargetLanguage()"
            (quizCompleted)="onQuizComplete($event)"
          />
        </div>
      }

      <!-- step 3: display name -->
      @if (onboardingService.currentStep() === 3) {
        <div class="mt-4">
          <label class="block text-sm mb-1" for="display-name">{{
            'onboarding.step4.label' | t
          }}</label>
          <input
            id="display-name"
            class="w-full bg-surface-200 border border-surface-100 text-text-primary p-2 rounded"
            [value]="onboardingService.displayName()"
            (input)="onDisplayNameInput($event)"
            placeholder="{{ 'onboarding.step4.placeholder' | t }}"
          />
        </div>
      }

      <!-- navigation buttons -->
      <div class="mt-8 flex justify-between">
        <app-button-secondary
          [disabled]="onboardingService.currentStep() === 0"
          (clicked)="onboardingService.prevStep()"
        >
          {{ 'common.back' | t }}
        </app-button-secondary>
        <app-button-primary [disabled]="!onboardingService.canGoNext()" (clicked)="handleNext()">
          {{
            onboardingService.currentStep() === onboardingService.steps.length - 1
              ? ('common.finish' | t)
              : ('common.next' | t)
          }}
        </app-button-primary>
      </div>
    </div>
  `,
  styles: [],
})
export class OnboardingWizardComponent {
  private readonly router = inject(Router);
  readonly onboardingService = inject(OnboardingService);
  readonly i18n = inject(I18nService);

  /** First selected target language code, used for the diagnostic quiz. */
  readonly firstTargetLanguage = computed(() => {
    const targets = this.onboardingService.targetLanguages();
    if (targets.size > 0) {
      return [...targets][0];
    }
    return 'en';
  });

  onNativeLanguageChange(event: Event): void {
    if (!(event.target instanceof HTMLSelectElement)) {
      return;
    }
    this.onboardingService.setNativeLanguage(event.target.value);
  }

  onDisplayNameInput(event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }
    this.onboardingService.setDisplayName(event.target.value);
  }

  onQuizComplete(result: { score: number; suggestedLevel: string; maxScore: number }): void {
    this.onboardingService.setQuizResult({
      score: result.score,
      suggestedCefr: result.suggestedLevel,
      percentage: result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0,
      skillBreakdown: {},
    });
  }

  handleNext(): void {
    this.onboardingService.nextStep();
    if (this.onboardingService.isOnboardingComplete()) {
      this.router.navigate(['/diagnostic-quiz']);
    }
  }
}
