import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface QuizResultPayload {
  score: number;
  suggestedCefr: string;
  percentage: number;
  skillBreakdown: Record<string, { score: number; max: number }>;
}

/**
 * Centralises all onboarding state and navigation logic.
 * Components should read signals exposed here instead of keeping
 * their own copies.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  readonly isOnboardingComplete = signal(false);

  private readonly http = inject(HttpClient);

  /** Available wizard steps (label keys for i18n). */
  readonly steps: { label: string }[] = [
    { label: 'onboarding.step1' },
    { label: 'onboarding.step2' },
    { label: 'onboarding.step4' },
  ];

  /** Current wizard step index (0-based). */
  readonly currentStep = signal(0);

  /** User's native language code (ISO 639-1). */
  readonly nativeLanguage = signal<string>('');

  /** Set of target language codes the user has selected. */
  readonly targetLanguages = signal<Set<string>>(new Set());

  /** The display name the user chose. */
  readonly displayName = signal<string>('');

  /** Diagnostic quiz result, populated after step 3. */
  readonly quizResult = signal<QuizResultPayload | null>(null);

  /**
   * Derived boolean that determines whether the "Next" button should be enabled.
   * Respects the requirements of each wizard step.
   */
  readonly canGoNext = computed(() => {
    const step = this.currentStep();
    if (step === 0) {
      return this.nativeLanguage() !== '';
    }
    if (step === 1) {
      return this.targetLanguages().size > 0;
    }
    // final step - a non-empty display name is required
    return this.displayName().trim().length > 0;
  });

  // ---- Mutation helpers -----------------------------------------

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
  }

  setDisplayName(name: string): void {
    this.displayName.set(name);
  }

  setQuizResult(result: QuizResultPayload): void {
    this.quizResult.set(result);
  }

  /** Advance to the next step; if already on the last step, call `finish()`. */
  nextStep(): void {
    if (this.currentStep() < this.steps.length - 1) {
      this.currentStep.update((v) => v + 1);
    } else {
      this.finish();
    }
  }

  /** Go back one step (no effect on the first step). */
  prevStep(): void {
    if (this.currentStep() > 0) {
      this.currentStep.update((v) => v - 1);
    }
  }

  /** Persist the fact that onboarding is finished and store a local flag. */
  async finish(): Promise<void> {
    this.isOnboardingComplete.set(true);
    try {
      window.localStorage.setItem('hellotalk_onboarding_done', 'true');
    } catch {
      // storage unavailable, ignore
    }
    // Also submit selections to the backend via API (fire and forget)
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
      // API call is optional - silently ignore failures
    }
  }

  // Legacy alias - preserve existing callers.
  completeOnboarding(): void {
    this.finish();
  }
}
