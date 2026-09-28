import { ErrorHandler, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HtmlSanitisationService } from '../../services/html-sanitisation.service';
import { I18nService } from '../../services/i18n.service';
import { TranslationResult, VocabularyStore } from '../../services/vocabulary.store';
import { WordDefinitionModalComponent } from './word-definition-modal.component';

const lookupResult: TranslationResult = {
  original_text: 'hola',
  translated_text: 'hello',
  detected_language: 'es',
  transliteration: 'hola',
  definition: 'A greeting.',
  pronunciation_url: 'https://example.com/hola.mp3',
};

describe('WordDefinitionModalComponent acceptance contract', () => {
  let fixture: ComponentFixture<WordDefinitionModalComponent>;
  let component: WordDefinitionModalComponent;
  let translateWordOrSentence: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    translateWordOrSentence = vi.fn().mockResolvedValue(lookupResult);

    await TestBed.configureTestingModule({
      imports: [WordDefinitionModalComponent],
      providers: [
        {
          provide: VocabularyStore,
          useValue: {
            getWordStatus: vi.fn().mockReturnValue({ level: 0, colorClass: '', colourClass: '' }),
            translateWordOrSentence,
            saveWord: vi.fn(),
            updateSrsLevel: vi.fn(),
          },
        },
        {
          provide: HtmlSanitisationService,
          useValue: {
            sanitiseText: (value: string) => value,
            sanitiseUrl: (value: string) => (value.startsWith('https://') ? value : ''),
          },
        },
        {
          provide: I18nService,
          useValue: {
            currentLang: signal('en-GB'),
            translate: (key: string) => key,
          },
        },
        { provide: ErrorHandler, useValue: { handleError: vi.fn() } },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(WordDefinitionModalComponent);
    fixture.componentRef.setInput('wordToken', 'hola');
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('looks up the selected token and exposes translation, definition and pronunciation data', async () => {
    await createComponent();

    expect(translateWordOrSentence).toHaveBeenCalledOnce();
    expect(translateWordOrSentence).toHaveBeenCalledWith('hola', 'en');
    expect(component.translationResult()).toEqual(lookupResult);
    expect(component.lookupFailed()).toBe(false);
  });

  it('uses the provider pronunciation URL and clears busy state when playback ends', async () => {
    let ended: (() => void) | undefined;
    const audio = {
      currentTime: 0,
      pause: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn((event: string, listener: () => void) => {
        if (event === 'ended') ended = listener;
      }),
    };
    const AudioMock = vi.fn(function AudioMock() {
      return audio;
    });
    vi.stubGlobal('Audio', AudioMock);
    await createComponent();

    component.playAudio();

    expect(AudioMock).toHaveBeenCalledWith('https://example.com/hola.mp3');
    expect(audio.play).toHaveBeenCalledOnce();
    expect(component.isAudioPlaying()).toBe(true);

    ended?.();

    expect(component.isAudioPlaying()).toBe(false);
    expect(component.audioFailed()).toBe(false);
  });

  it('does not construct audio playback when the provider URL is unsafe', async () => {
    translateWordOrSentence.mockResolvedValue({
      ...lookupResult,
      pronunciation_url: 'javascript:alert(1)',
    });
    const AudioMock = vi.fn();
    vi.stubGlobal('Audio', AudioMock);
    await createComponent();

    component.playAudio();

    expect(component.translationResult()?.pronunciation_url).toBeUndefined();
    expect(AudioMock).not.toHaveBeenCalled();
    expect(component.isAudioPlaying()).toBe(false);
  });
});
