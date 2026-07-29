import { Component, signal, computed, inject } from '@angular/core';
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
        @for (step of steps(); track $index) {
          <div
            class="flex items-center gap-2 p-2 rounded"
            [class.bg-accent/20]="currentStep() === $index"
          >
            <span class="w-6 h-6 flex items-center justify-center rounded-full bg-surface-variant text-sm">
              {{ $index + 1 }}
            </span>
            <span>{{ step.label | t }}</span>
          </div>
        }
      </div>

      <!-- step content -->
      @if (currentStep() === 0) {
        <div class="mt-4">
          <label class="block text-sm mb-1">{{ 'onboarding.step1.label' | t }}</label>
          <select
            class="w-full bg-surface-variant text-on-surface p-2 rounded"
            [value]="nativeLanguage()"
            (change)="onNativeLanguageChange($event)"
          >
            <option value="">{{ 'onboarding.step1.placeholder' | t }}</option>
            @for (lang of i18n.availableLanguages; track lang.code) {
              <option [value]="lang.code">{{ lang.flag }} {{ lang.nativeName }}</option>
            }
          </select>
        </div>
      }

      @if (currentStep() === 1) {
        <div class="mt-4">
          <label class="block text-sm mb-1">{{ 'onboarding.step2.label' | t }}</label>
          <div class="grid grid-cols-1 gap-2">
            @for (lang of i18n.availableLanguages; track lang.code) {
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  [checked]="targetLanguages().has(lang.code)"
                  (change)="toggleTargetLanguage(lang.code)"
                />
                <span>{{ lang.flag }} {{ lang.nativeName }}</span>
              </label>
            }
          </div>
        </div>
      }

      @if (currentStep() === 2) {
        <div class="mt-4">
          <label class="block text-sm mb-1">{{ 'onboarding.step3.label' | t }}</label>
          <input
            class="w-full bg-surface-variant text-on-surface p-2 rounded"
            [value]="displayName()"
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
          [disabled]="currentStep() === 0"
          (click)="prevStep()"
        >
          {{ 'common.back' | t }}
        </button>
        <button
          type="button"
          class="app-button-primary"
          [disabled]="!canGoNext()"
          (click)="nextStep()"
        >
          {{
            currentStep() === steps().length - 1
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
  private readonly onboardingService = inject(OnboardingService);
  readonly i18n = inject(I18nService);

  readonly steps = signal([
    { label: 'onboarding.step1' },
    { label: 'onboarding.step2' },
    { label: 'onboarding.step3' },
  ]);

  readonly currentStep = signal(0);
  readonly nativeLanguage = signal<string>('');
  readonly targetLanguages = signal<Set<string>>(new Set());
  readonly displayName = signal<string>('');

  readonly canGoNext = computed(() => {
    if (this.currentStep() === 0) {
      return this.nativeLanguage() !== '';
    }
    if (this.currentStep() === 1) {
      return this.targetLanguages().size > 0;
    }
    // last step: display name required
    return this.displayName().trim().length > 0;
  });

  onNativeLanguageChange(event: Event): void {
    if (!(event.target instanceof HTMLSelectElement)) {
      return;
    }
    this.nativeLanguage.set(event.target.value);
  }

  toggleTargetLanguage(code: string): void {
    this.targetLanguages.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(code)) {
        newSet.delete(code);
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  }

  onDisplayNameInput(event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }
    this.displayName.set(event.target.value);
  }

  nextStep(): void {
    if (this.currentStep() < this.steps().length - 1) {
      this.currentStep.update((val) => val + 1);
    } else {
      this.finish();
    }
  }

  prevStep(): void {
    if (this.currentStep() > 0) {
      this.currentStep.update((val) => val - 1);
    }
  }

  finish(): void {
    // persist user choices if needed (future)
    this.onboardingService.completeOnboarding();
    this.router.navigate(['/home']);
  }
}
