import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../services/i18n.service';
import {
  LearningPracticeService,
  VerbSession,
} from '../../services/learning-practice.service';
import { VerbConjugationTrainerComponent } from './verb-conjugation-trainer.component';

const TRANSLATIONS: Record<string, string> = {
  'verbConjugation.title': 'Verb conjugation trainer',
  'verbConjugation.subtitle': 'Practise conjugating verbs.',
  'verbConjugation.languageLabel': 'Language',
  'verbConjugation.tenseLabel': 'Tense',
  'verbConjugation.tense.present': 'Present',
  'verbConjugation.tense.past': 'Past',
  'verbConjugation.person.firstSingular': 'I',
  'verbConjugation.person.secondSingular': 'you (informal)',
  'verbConjugation.person.thirdSingular': 'he or she',
  'verbConjugation.person.firstPlural': 'we',
  'verbConjugation.person.secondPlural': 'you (plural)',
  'verbConjugation.person.thirdPlural': 'they',
  'verbConjugation.prompt': 'Conjugate "{{verb}}" for {{person}} in the {{tense}} tense.',
  'verbConjugation.translation': 'Meaning: {{translation}}',
  'verbConjugation.answerOptions': 'Choose the correct conjugation',
  'verbConjugation.questionCounter': 'Question {{current}} of {{total}}',
  'verbConjugation.loading': 'Loading exercises...',
  'verbConjugation.error': 'Unable to load exercises. Please try again.',
  'verbConjugation.correct': 'Correct!',
  'verbConjugation.incorrect': 'Not quite. The correct answer is "{{answer}}".',
  'verbConjugation.next': 'Next question',
  'verbConjugation.finish': 'Finish session',
  'verbConjugation.newSession': 'New questions',
  'verbConjugation.restart': 'Practise again',
  'verbConjugation.complete.title': 'Session complete',
  'verbConjugation.complete.message': 'You scored {{score}} out of {{total}}.',
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

function createSession(overrides: Partial<VerbSession> = {}): VerbSession {
  return {
    languageCode: 'es',
    languageName: 'Spanish',
    tense: 'present',
    exercises: [
      {
        id: 'verb:es:hablar:present:0',
        languageCode: 'es',
        infinitive: 'hablar',
        translation: 'to speak',
        tense: 'present',
        person: 'firstSingular',
        options: ['hablo', 'hablas', 'habla', 'hablamos'],
      },
    ],
    ...overrides,
  };
}

describe('VerbConjugationTrainerComponent', () => {
  const service = {
    listVerbLanguages: vi.fn(),
    getVerbSession: vi.fn(),
    checkVerbAnswer: vi.fn(),
  };

  beforeEach(async () => {
    service.listVerbLanguages.mockResolvedValue([
      { code: 'es', name: 'Spanish', tenses: ['present', 'past'], verbCount: 5 },
      { code: 'fr', name: 'French', tenses: ['present', 'past'], verbCount: 5 },
    ]);
    service.getVerbSession.mockResolvedValue(createSession());
    service.checkVerbAnswer.mockResolvedValue({
      correct: true,
      expected: 'hablo',
      submitted: 'hablo',
      languageCode: 'es',
    });

    await TestBed.configureTestingModule({
      imports: [VerbConjugationTrainerComponent],
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
    const fixture = TestBed.createComponent(VerbConjugationTrainerComponent);
    await fixture.whenStable();
    return fixture;
  }

  it('loads the session from the API and renders the prompt', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(service.listVerbLanguages).toHaveBeenCalled();
    expect(service.getVerbSession).toHaveBeenCalledWith('es', 'present', 5);
    expect(text).toContain('Verb conjugation trainer');
    expect(text).toContain('Conjugate "hablar" for I in the Present tense.');
    expect(text).toContain('Meaning: to speak');
    expect(text).toContain('Question 1 of 1');
    expect(text).toContain('hablo');
  });

  it('submits the selected answer and shows correct feedback', async () => {
    const fixture = await render();
    const options = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const option = options.find((button) => button.textContent?.trim() === 'hablo');

    expect(option).toBeDefined();
    option?.click();
    await fixture.whenStable();

    expect(service.checkVerbAnswer).toHaveBeenCalledWith(
      'verb:es:hablar:present:0',
      'hablo',
    );
    expect(fixture.nativeElement.textContent).toContain('Correct!');
    expect(fixture.nativeElement.textContent).toContain('Finish session');
  });

  it('shows the expected answer for an incorrect attempt', async () => {
    service.checkVerbAnswer.mockResolvedValue({
      correct: false,
      expected: 'hablo',
      submitted: 'hablas',
      languageCode: 'es',
    });
    const fixture = await render();
    const options = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    options.find((button) => button.textContent?.trim() === 'hablas')?.click();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain(
      'Not quite. The correct answer is "hablo".',
    );
  });

  it('advances to the completion summary after the final question', async () => {
    const fixture = await render();
    const options = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    options.find((button) => button.textContent?.trim() === 'hablo')?.click();
    await fixture.whenStable();

    const finish = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    finish.find((button) => button.textContent?.trim() === 'Finish session')?.click();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Session complete');
    expect(fixture.nativeElement.textContent).toContain('You scored 1 out of 1.');
  });

  it('reloads the session when the language changes', async () => {
    const fixture = await render();
    const component = fixture.componentInstance;

    component.onLanguageChange('fr');
    await fixture.whenStable();

    expect(service.getVerbSession).toHaveBeenCalledWith('fr', 'present', 5);
  });

  it('shows a retry state when the session cannot be loaded', async () => {
    service.getVerbSession.mockRejectedValue(new Error('offline'));
    const fixture = TestBed.createComponent(VerbConjugationTrainerComponent);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });
});
