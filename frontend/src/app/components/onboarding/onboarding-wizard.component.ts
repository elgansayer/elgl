import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { OnboardingService } from '../../services/onboarding.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="onboarding-wizard surface text-on-surface ps-4 pe-4 pt-6 pb-6">
      <h1 class="text-xl font-bold">{{ 'onboarding.title' | t }}</h1>
      <p class="text-sm opacity-80">{{ 'onboarding.subtitle' | t }}</p>

      <!-- step progress indicators -->
      <div class="mt-4 flex gap-2">
        @for (step of onboardingService.steps; track $index) {
          <div
            class="flex items-center gap-2 p-2 rounded"
            [class.bg-accent/20]="onboardingService.currentStep() === $index"
          >
            <span class="w-6 h-6 flex items-center justify-center rounded-full bg-surface-variant text-sm">
              {{ $index + 1 }}
            </span>
            <span>{{ step.label | t }}</span>
          </div>
        }
      </div>

      <!-- step content -->
      @if (onboardingService.currentStep() === 0) {
        <div class="mt-4">
          <label class="block text-sm mb-1" for="native-lang">{{ 'onboarding.step1.label' | t }}</label>
          <select
            id="native-lang"
            class="w-full bg-surface-variant text-on-surface p-2 rounded"
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

      @if (onboardingService.currentStep() === 2) {
        <div class="mt-4">
          <label class="block text-sm mb-1" for="display-name">{{ 'onboarding.step3.label' | t }}</label>
          <input
            id="display-name"
            class="w-full bg-surface-variant text-on-surface p-2 rounded"
            [value]="onboardingService.displayName()"
            (input)="onDisplayNameInput($event)"
            placeholder="{{ 'onboarding.step3.placeholder' | t }}"
          />
        </div>
      }

      <!-- navigation buttons -->
      <div class="mt-8 flex justify-between">
        <button
          type="button"
          class="app-button-secondary"
          [disabled]="onboardingService.currentStep() === 0"
          (click)="onboardingService.prevStep()"
        >
          {{ 'common.back' | t }}
        </button>
        <button
          type="button"
          class="app-button-primary"
          [disabled]="!onboardingService.canGoNext()"
          (click)="handleNext()"
        >
          {{
            onboardingService.currentStep() === onboardingService.steps.length - 1
              ? ('common.finish' | t)
              : ('common.next' | t)
          }}
        </button>
      </div>
    </div>
  `,
  styles: [],
})
export class OnboardingWizardComponent {
  private readonly router = inject(Router);
  readonly onboardingService = inject(OnboardingService);
  readonly i18n = inject(I18nService);

  /** Local computed to decide navigation – delegating to service. */
  readonly canGoNext = computed(() => this.onboardingService.canGoNext());

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

  handleNext(): void {
    this.onboardingService.nextStep();
    if (this.onboardingService.isOnboardingComplete()) {
      this.router.navigate(['/diagnostic-quiz']);
    }
  }
}
