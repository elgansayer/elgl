import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { DiagnosticQuizResult } from '../../services/quiz.service';
import { I18nService } from '../../services/i18n.service';
import { OnboardingService } from '../../services/onboarding.service';
import { TranslatePipe } from '../../services/translate.pipe';
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

      <div class="mt-4 flex flex-wrap gap-2" aria-label="{{ 'onboarding.title' | t }}">
        @for (step of onboardingService.steps; track $index) {
          <div
            class="flex items-center gap-2 rounded p-2"
            [class.bg-accent/20]="onboardingService.currentStep() === $index"
            [attr.aria-current]="onboardingService.currentStep() === $index ? 'step' : null"
          >
            <span class="flex h-6 w-6 items-center justify-center rounded-full bg-surface-200 text-sm">
              {{ $index + 1 }}
            </span>
            <span>{{ step.label | t }}</span>
          </div>
        }
      </div>

      @if (onboardingService.currentStep() === 0) {
        <div class="mt-6">
          <app-diagnostic-quiz
            [targetLanguage]="onboardingService.primaryTargetLanguage()"
            (quizCompleted)="onQuizCompleted($event)"
          />

          @if (onboardingService.quizResult(); as result) {
            <div class="mx-auto mt-4 max-w-3xl rounded-sheet bg-surface-200 p-4" role="status">
              <h2 class="font-semibold">{{ 'diagnosticQuiz.resultTitle' | t }}</h2>
              <p class="mt-1 text-sm text-text-secondary">
                {{
                  'diagnosticQuiz.scoreLabel'
                    | t: { score: result.score, maxScore: result.maxScore }
                }}
              </p>
              <p class="text-sm text-text-secondary">
                {{ 'diagnosticQuiz.levelLabel' | t: { level: result.suggestedCefr } }}
              </p>
            </div>
          }
        </div>
      }

      <div class="mt-8 flex flex-wrap justify-between gap-3">
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

  onNativeLanguageChange(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      this.onboardingService.setNativeLanguage(event.target.value);
    }
  }

  onDisplayNameInput(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.onboardingService.setDisplayName(event.target.value);
    }
  }

  onQuizCompleted(result: DiagnosticQuizResult): void {
    this.onboardingService.setQuizResult(result);
  }

  handleNext(): void {
    this.onboardingService.nextStep();
    if (this.onboardingService.isOnboardingComplete()) {
      void this.router.navigate(['/ai-conversation']);
    }
  }
}
