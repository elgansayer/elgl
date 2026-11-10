import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../services/i18n.service';
import {
  IpaCatalogue,
  IpaQuiz,
  LearningPracticeService,
} from '../../services/learning-practice.service';
import { IpaAlphabetComponent } from './ipa-alphabet.component';

const TRANSLATIONS: Record<string, string> = {
  'ipaAlphabet.title': 'IPA alphabet',
  'ipaAlphabet.subtitle': 'Explore the sounds of your target language.',
  'ipaAlphabet.languageLabel': 'Language',
  'ipaAlphabet.mode.label': 'Choose a view',
  'ipaAlphabet.mode.chart': 'Sound chart',
  'ipaAlphabet.mode.practice': 'Practise',
  'ipaAlphabet.group.vowel': 'Vowels',
  'ipaAlphabet.group.diphthong': 'Diphthongs',
  'ipaAlphabet.group.nasal': 'Nasal vowels',
  'ipaAlphabet.group.consonant': 'Consonants',
  'ipaAlphabet.loading': 'Loading the sound chart...',
  'ipaAlphabet.error': 'Unable to load the IPA module. Please try again.',
  'ipaAlphabet.practicePrompt': 'Which word contains the sound {{symbol}}?',
  'ipaAlphabet.answerOptions': 'Choose the matching word',
  'ipaAlphabet.questionCounter': 'Question {{current}} of {{total}}',
  'ipaAlphabet.correct': 'Correct!',
  'ipaAlphabet.incorrect': 'Not quite. The answer is "{{answer}}".',
  'ipaAlphabet.next': 'Next question',
  'ipaAlphabet.finish': 'Finish practice',
  'ipaAlphabet.restart': 'Practise again',
  'ipaAlphabet.backToChart': 'Back to sound chart',
  'ipaAlphabet.complete.title': 'Practice complete',
  'ipaAlphabet.complete.message': 'You scored {{score}} out of {{total}}.',
  'common.retry': 'Retry',
};

function translate(key: string, params?: Record<string, unknown>): string {
  let text = TRANSLATIONS[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), String(value));
    }
  }
  return text;
}

const CATALOGUE: IpaCatalogue = {
  languageCode: 'en',
  languageName: 'English',
  phonemes: [
    {
      id: 'i-long',
      symbol: '/iː/',
      type: 'vowel',
      example: 'see',
      description: 'Close front unrounded vowel, as in see',
    },
    {
      id: 'p',
      symbol: '/p/',
      type: 'consonant',
      example: 'pen',
      description: 'Voiceless bilabial plosive, as in pen',
    },
  ],
};

const QUIZ: IpaQuiz = {
  languageCode: 'en',
  languageName: 'English',
  questions: [
    {
      id: 'ipa:en:i-long',
      symbol: '/iː/',
      type: 'vowel',
      description: 'Close front unrounded vowel, as in see',
      options: ['see', 'pen', 'cat', 'sun'],
    },
  ],
};

describe('IpaAlphabetComponent', () => {
  const service = {
    listIpaLanguages: vi.fn(),
    getIpaCatalogue: vi.fn(),
    getIpaQuiz: vi.fn(),
    checkIpaAnswer: vi.fn(),
  };

  beforeEach(async () => {
    service.listIpaLanguages.mockResolvedValue([
      { code: 'en', name: 'English', phonemeCount: 44 },
    ]);
    service.getIpaCatalogue.mockResolvedValue(CATALOGUE);
    service.getIpaQuiz.mockResolvedValue(QUIZ);
    service.checkIpaAnswer.mockResolvedValue({
      correct: true,
      expected: 'see',
      submitted: 'see',
      languageCode: 'en',
    });

    await TestBed.configureTestingModule({
      imports: [IpaAlphabetComponent],
      providers: [
        { provide: LearningPracticeService, useValue: service },
        { provide: I18nService, useValue: { translate } },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function render() {
    const fixture = TestBed.createComponent(IpaAlphabetComponent);
    await fixture.whenStable();
    return fixture;
  }

  it('renders the grouped sound chart from the API catalogue', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(service.getIpaCatalogue).toHaveBeenCalledWith('en');
    expect(text).toContain('IPA alphabet');
    expect(text).toContain('Vowels');
    expect(text).toContain('Consonants');
    expect(text).toContain('/iː/');
    expect(text).toContain('see');
    expect(text).toContain('/p/');
  });

  it('submits a practice answer and shows feedback', async () => {
    const fixture = await render();
    fixture.componentInstance.setMode('practice');
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain(
      'Which word contains the sound /iː/?',
    );

    const options = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    options.find((button) => button.textContent?.trim() === 'see')?.click();
    await fixture.whenStable();

    expect(service.checkIpaAnswer).toHaveBeenCalledWith('ipa:en:i-long', 'see');
    expect(fixture.nativeElement.textContent).toContain('Correct!');
  });

  it('shows the expected answer for an incorrect attempt', async () => {
    service.checkIpaAnswer.mockResolvedValue({
      correct: false,
      expected: 'see',
      submitted: 'pen',
      languageCode: 'en',
    });
    const fixture = await render();
    fixture.componentInstance.setMode('practice');
    await fixture.whenStable();

    const options = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    options.find((button) => button.textContent?.trim() === 'pen')?.click();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain(
      'Not quite. The answer is "see".',
    );
  });

  it('shows the completion summary after the final question', async () => {
    const fixture = await render();
    fixture.componentInstance.setMode('practice');
    await fixture.whenStable();

    const options = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    options.find((button) => button.textContent?.trim() === 'see')?.click();
    await fixture.whenStable();

    const finish = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    finish.find((button) => button.textContent?.trim() === 'Finish practice')?.click();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Practice complete');
    expect(fixture.nativeElement.textContent).toContain('You scored 1 out of 1.');
  });

  it('reloads the catalogue when the language changes', async () => {
    const fixture = await render();
    fixture.componentInstance.onLanguageChange('fr');
    await fixture.whenStable();

    expect(service.getIpaCatalogue).toHaveBeenCalledWith('fr');
    expect(service.getIpaQuiz).toHaveBeenCalledWith('fr', 5);
  });

  it('shows a retry state when the catalogue cannot be loaded', async () => {
    service.getIpaCatalogue.mockRejectedValue(new Error('offline'));
    const fixture = TestBed.createComponent(IpaAlphabetComponent);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });
});
