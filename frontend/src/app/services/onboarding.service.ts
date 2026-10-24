import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import type { DiagnosticQuizResult } from './quiz.service';

/**
 * Centralises all onboarding state and navigation logic.
 * Components should read signals exposed here instead of keeping
 * their own copies.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  readonly isOnboardingComplete = signal(false);

  private readonly http = inject(HttpClient);

  readonly steps: { label: string }[] = [
    { label: 'diagnosticQuiz.title' },
  ];

  readonly currentStep = signal(0);
  readonly nativeLanguage = signal<string>('en');
  readonly targetLanguages = signal<Set<string>>(new Set(['es']));
  readonly displayName = signal<string>('User');
  readonly quizResult = signal<DiagnosticQuizResult | null>(null);

  readonly primaryTargetLanguage = computed(
    () => Array.from(this.targetLanguages())[0] ?? 'es',
  );

  readonly canGoNext = computed(() => {
    return this.quizResult() !== null;
  });

  setNativeLanguage(code: string): void {
    this.nativeLanguage.set(code);
  }

  toggleTargetLanguage(code: string): void {
    this.targetLanguages.update((set) => {
      const copy = new Set(set);
      if (copy.has(code)) {
        copy.delete(code);
      } else {
        copy.add(code);
      }
      return copy;
    });
    // A diagnostic result belongs to the selected target-language context.
    // Changing that context requires a fresh authoritative result.
    this.quizResult.set(null);
  }

  setDisplayName(name: string): void {
    this.displayName.set(name);
  }

  setQuizResult(result: DiagnosticQuizResult): void {
    this.quizResult.set(result);
  }

  nextStep(): void {
    if (!this.canGoNext()) return;
    if (this.currentStep() < this.steps.length - 1) {
      this.currentStep.update((value) => value + 1);
    } else {
      void this.finish();
    }
  }

  prevStep(): void {
    if (this.currentStep() > 0) {
      this.currentStep.update((value) => value - 1);
    }
  }

  async finish(): Promise<void> {
    this.isOnboardingComplete.set(true);
    try {
      window.localStorage.setItem('hellotalk_onboarding_done', 'true');
    } catch {
      // Storage may be unavailable in privacy-restricted browser contexts.
    }

    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/users/onboarding`, {
          nativeLanguage: this.nativeLanguage(),
          targetLanguages: Array.from(this.targetLanguages()),
          displayName: this.displayName(),
          quizResult: this.quizResult(),
        }),
      );
    } catch {
      // Existing onboarding persistence remains best-effort. The diagnostic
      // itself is already persisted by the authenticated quiz endpoint.
    }
  }

  completeOnboarding(): void {
    void this.finish();
  }
}
