import { Injectable, signal } from '@angular/core';

export interface LingqOnboardingStep {
  key: string;
  title: string;
  text: string;
}

/**
 * Manages the onboarding tour state for the LingQ Interactive Reader feature.
 * Steps correspond to `joyrideStep` directive names in the AudioSyncReaderComponent template.
 */
@Injectable({ providedIn: 'root' })
export class LingqOnboardingService {
  private readonly storageKey = 'hellotalk_lingq_onboarding_done';

  /** Whether the lingq onboarding tour has been completed this session. */
  readonly isTourInProgress = signal(false);

  /** Step names registered with the JoyrideDirective in the AudioSyncReaderComponent. */
  readonly steps: LingqOnboardingStep[] = [
    {
      key: 'lingqStepTitle',
      title: 'LingQ Interactive Reader',
      text: 'Welcome to the LingQ Interactive Reader. Immerse yourself in real content with synchronised audio and interactive word definitions.',
    },
    {
      key: 'lingqStepPlayback',
      title: 'Audio Playback',
      text: 'Tap here to play or pause the synchronised audio. Words will highlight in real time as they are spoken, helping you follow along naturally.',
    },
    {
      key: 'lingqStepTokens',
      title: 'Interactive Text',
      text: 'Tap any word to see its definition, save it to your SRS flashcard deck, and track your vocabulary progress with colour-coded highlighting.',
    },
  ];

  get stepNames(): string[] {
    return this.steps.map((s) => s.key);
  }

  markComplete(): void {
    this.isTourInProgress.set(false);
    try {
      window.localStorage.setItem(this.storageKey, 'true');
    } catch {
      // storage unavailable, ignore
    }
  }

  isCompleted(): boolean {
    try {
      return window.localStorage.getItem(this.storageKey) === 'true';
    } catch {
      return false;
    }
  }
}