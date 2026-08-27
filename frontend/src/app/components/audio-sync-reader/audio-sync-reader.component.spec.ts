import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AudioSyncReaderComponent } from './audio-sync-reader.component';
import { VocabularyStore } from '../../services/vocabulary.store';
import { LingqOnboardingService } from '../../services/lingq-onboarding.service';
import { signal } from '@angular/core';

describe('AudioSyncReaderComponent', () => {
  let component: AudioSyncReaderComponent;
  let fixture: ComponentFixture<AudioSyncReaderComponent>;
  let mockVocabStore: Partial<VocabularyStore>;
  let mockOnboardingService: Partial<LingqOnboardingService>;

  beforeEach(async () => {
    mockVocabStore = {
      flashcardMap: signal(new Map()),
      getWordStatus: () => ({
        level: 0,
        colorClass: 'bg-blue-500/20 text-blue-900',
        colourClass: 'bg-blue-500/20 text-blue-900',
      }),
    };

    mockOnboardingService = {
      isCompleted: () => true,
      isTourInProgress: signal(false),
    };

    await TestBed.configureTestingModule({
      imports: [AudioSyncReaderComponent, HttpClientTestingModule],
      providers: [
        { provide: VocabularyStore, useValue: mockVocabStore },
        { provide: LingqOnboardingService, useValue: mockOnboardingService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioSyncReaderComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('text', 'Hello world, welcome to HelloTalk immersion.');
    fixture.componentRef.setInput('language', 'en-GB');
    fixture.componentRef.setInput('isVip', true);
    fixture.detectChanges();
  });

  it('should create and segment word tokens using Intl.Segmenter or fallback', () => {
    expect(component).toBeTruthy();
    expect(component.tokens().length).toBeGreaterThan(0);
    const words = component.tokens().filter((t) => t.isWordLike);
    expect(words[0].segment).toBe('Hello');
    expect(words[1].segment).toBe('world');
  });

  it('should toggle play state and update active token index during simulation', () => {
    const mockSpeechSynthesis = {
      cancel: () => {},
      speak: (ut: { onstart?: () => void }) => {
        if (ut && ut.onstart) ut.onstart();
      },
    };
    Object.defineProperty(window, 'speechSynthesis', {
      value: mockSpeechSynthesis,
      writable: true,
      configurable: true,
    });
    // Also mock SpeechSynthesisUtterance globally as a constructor function
    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
      function (this: Record<string, unknown>) {
        return this;
      };

    expect(component.isPlaying()).toBe(false);
    component.togglePlay();
    expect(component.isPlaying()).toBe(true);

    component.stopPlayback();
    expect(component.isPlaying()).toBe(false);
    expect(component.activeTokenIndex()).toBe(-1);
  });

  it('should emit wordClicked and select token when token is clicked', () => {
    const word = component.tokens().find((t) => t.isWordLike && t.segment === 'welcome');
    expect(word).toBeDefined();

    let clickedWord = '';
    component.wordClicked.subscribe((e) => (clickedWord = e.token));

    if (word) {
      component.onTokenClick(word);
      expect(clickedWord).toBe('welcome');
      expect(component.selectedToken()?.token).toBe('welcome');
    }
  });
});
